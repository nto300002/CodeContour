import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measureTypeScriptProject } from "../src/analysis-measurement.js";
import type { RelationAuditScope } from "../src/analysis-measurement.js";
import type { ResolutionMetricRelation } from "../src/relation-resolution.js";

const root = process.env.CODECONTOUR_REAL_REPOSITORY_ROOT;
const output = process.env.CODECONTOUR_REAL_MEASUREMENT_OUTPUT;
const commit = process.env.CODECONTOUR_REAL_REPOSITORY_COMMIT;
const repository = process.env.CODECONTOUR_REAL_REPOSITORY_ID;
const tsconfigPath = process.env.CODECONTOUR_REAL_TSCONFIG ?? "tsconfig.json";
const expectedPath = process.env.CODECONTOUR_REAL_EXPECTED_RELATIONS;
const exec = promisify(execFile);
const configured = Boolean(root && output && commit && repository && expectedPath);

describe.skipIf(process.env.CODECONTOUR_REQUIRE_REAL_MEASUREMENT !== "1")("real Repository measurement command configuration", () => {
  it("requires a Repository root, identity, Commit, output path, and expected Relation manifest", () => {
    expect(configured).toBe(true);
  });
});

describe("Repository audit contract validation", () => {
  it("rejects contracts without a representative Scope or complete expected Relation", () => {
    expect(isRepositoryAuditContract({ repository: "repo", commit: "commit", auditScopes: [], expectedRelations: [] })).toBe(false);
    expect(isRepositoryAuditContract({ repository: "repo", commit: "commit", auditScopes: [{ type: "CALLS", from: "caller" }], expectedRelations: [{ type: "CALLS", from: "caller", resolution: "RESOLVED" }] })).toBe(false);
    expect(isRepositoryAuditContract({ repository: "repo", commit: "commit", auditScopes: [{ type: "CALLS", from: "caller" }], expectedRelations: [] })).toBe(true);
  });
});

describe.skipIf(!configured)("real Repository measurement", () => {
  it("fails closed when the fixed-Commit audit has an FP or FN", async () => {
    const head = (await exec("git", ["-C", root!, "rev-parse", "HEAD"])).stdout.trim();
    const dirtyPaths = (await exec("git", ["-C", root!, "status", "--porcelain"])).stdout.split("\n").filter(Boolean).map((line) => line.slice(3));
    expect(head).toBe(commit);
    const manifest = await readFile(expectedPath!, "utf8");
    const parsed: unknown = JSON.parse(manifest);
    expect(isRepositoryAuditContract(parsed)).toBe(true);
    if (!isRepositoryAuditContract(parsed)) throw new Error("Repository audit contract must define repository, commit, non-empty auditScopes, and complete expectedRelations");
    expect(parsed.repository).toBe(repository);
    expect(parsed.commit).toBe(commit);
    const measurement = await measureTypeScriptProject({ repositoryRoot: root!, tsconfigPath, auditScopes: parsed.auditScopes, expectedRelations: parsed.expectedRelations });
    const measurementConfig = await readFile(join(root!, tsconfigPath), "utf8");
    await writeFile(output!, `${JSON.stringify({ repository: repository!, commit: head, tsconfigPath, dirtyPaths, measurementConfigSha256: createHash("sha256").update(measurementConfig).digest("hex"), auditContractPath: expectedPath, auditContractSha256: createHash("sha256").update(manifest).digest("hex"), auditScopes: parsed.auditScopes, measurement }, null, 2)}\n`, "utf8");
    expect(measurement.status).not.toBe("FAILED");
    expect("status" in measurement.accuracy).toBe(false);
    if ("status" in measurement.accuracy) throw new Error("Expected Relation manifest must produce an audited accuracy result");
    expect(measurement.accuracy.fp).toBe(0);
    expect(measurement.accuracy.fn).toBe(0);
    expect(measurement.relationReview.some((item) => item.verdict === "FP" || item.verdict === "FN")).toBe(false);
  }, 120_000);
});

interface RepositoryAuditContract {
  repository: string;
  commit: string;
  auditScopes: RelationAuditScope[];
  expectedRelations: ResolutionMetricRelation[];
}

function isRepositoryAuditContract(value: unknown): value is RepositoryAuditContract {
  if (!value || typeof value !== "object") return false;
  const contract = value as Record<string, unknown>;
  return typeof contract.repository === "string" && contract.repository.length > 0
    && typeof contract.commit === "string" && contract.commit.length > 0
    && Array.isArray(contract.auditScopes) && contract.auditScopes.length > 0 && contract.auditScopes.every((scope) => isAuditScope(scope))
    && Array.isArray(contract.expectedRelations) && contract.expectedRelations.every((relation) => isMetricRelation(relation))
    && (contract.expectedRelations as ResolutionMetricRelation[]).every((relation) => (contract.auditScopes as RelationAuditScope[]).some((scope) => scope.type === relation.type && scope.from === relation.from));
}

function isAuditScope(value: unknown): value is RelationAuditScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Record<string, unknown>;
  return typeof scope.type === "string" && scope.type.length > 0 && typeof scope.from === "string" && scope.from.length > 0;
}

function isMetricRelation(value: unknown): value is ResolutionMetricRelation {
  if (!value || typeof value !== "object") return false;
  const relation = value as Record<string, unknown>;
  return typeof relation.type === "string" && relation.type.length > 0
    && typeof relation.from === "string" && relation.from.length > 0
    && (relation.resolution === "RESOLVED" || relation.resolution === "INFERRED" || relation.resolution === "UNKNOWN")
    && typeof relation.syntaxCategory === "string" && relation.syntaxCategory.length > 0;
}
