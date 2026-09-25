import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { measureTypeScriptProject, writeMeasurementReport } from "../src/analysis-measurement.js";
import type { AnalysisMeasurement } from "../src/analysis-measurement.js";
import type { ResolutionMetricRelation } from "../src/relation-resolution.js";

const savedReports: Array<{ repository: "small" | "medium"; result: AnalysisMeasurement }> = [];

describe("measureTypeScriptProject", () => {
  it.each([{ name: "small", files: 10, linesPerFile: 120 }, { name: "medium", files: 100, linesPerFile: 120 }])("records required metrics for a $name Repository", async ({ files, linesPerFile }) => {
    const fixture = await repositoryFixture(files, linesPerFile);
    const result = await measureTypeScriptProject({ repositoryRoot: fixture.root, tsconfigPath: "tsconfig.json", expectedRelations: fixture.expectedRelations });
    expect(result.status, JSON.stringify(result)).toBe("COMPLETE");
    expect(result.metrics).toEqual(expect.objectContaining({ loc: expect.any(Number), fileCount: files, indexTimeMs: expect.any(Number), processMaxRSSBytes: expect.any(Number), symbolCount: expect.any(Number), relationCount: expect.any(Number), unknownCount: expect.any(Number) }));
    expect(result.environment).toEqual({ nodeVersion: process.version, platform: process.platform, memoryMeasurement: "PROCESS_MAX_RSS_SINCE_START" });
    expect(result.metrics.loc).toBeGreaterThanOrEqual(files * linesPerFile);
    expect(result.metrics.symbolCount).toBeGreaterThan(0);
    if ("status" in result.accuracy) throw new Error("fixture relations must be reviewed");
    expect(result.accuracy, JSON.stringify(result.relationReview)).toMatchObject({ tp: 2, fp: 0, fn: 0, unknown: 1 });
    expect(result.relationReview.filter((relation) => relation.verdict === "FP")).toEqual([]);
    const reportPath = join(fixture.root, "measurement.json");
    await writeMeasurementReport(reportPath, result);
    expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual(result);
    savedReports.push({ repository: files === 10 ? "small" : "medium", result });
  });

  it("continues after one parse-failed File and records unsupported syntax as UNKNOWN", async () => {
    const fixture = await repositoryFixture(10, 120);
    await writeFile(join(fixture.root, "src", "broken.ts"), "export function {", "utf8");
    const unexpectedUnknown: ResolutionMetricRelation = { ...fixture.expectedRelations[2], reason: "MISSING_EXPORT" };
    const result = await measureTypeScriptProject({ repositoryRoot: fixture.root, tsconfigPath: "tsconfig.json", expectedRelations: [...fixture.expectedRelations.slice(0, 2), unexpectedUnknown] });
    expect(result.status, JSON.stringify(result)).toBe("PARTIAL");
    expect(result.partialFailures).toEqual(expect.arrayContaining([expect.objectContaining({ stage: "SYMBOL_INDEX", files: expect.arrayContaining(["src/broken.ts"]) })]));
    expect(result.metrics.unknownCount).toBeGreaterThan(0);
    if ("status" in result.accuracy) throw new Error("fixture relations must be reviewed");
    expect(result.accuracy).toMatchObject({ fp: 1, fn: 1 });
    expect(result.relationReview).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "CALLS", resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS", verdict: "FP" }),
      expect.objectContaining({ ...unexpectedUnknown, verdict: "FN" }),
    ]));
  });

  it("audits an explicitly declared Scope even when that Scope expects no Relations", async () => {
    const fixture = await repositoryFixture(10, 120);
    const callScope = fixture.expectedRelations[0];
    const result = await measureTypeScriptProject({
      repositoryRoot: fixture.root,
      tsconfigPath: "tsconfig.json",
      auditScopes: [{ type: callScope.type, from: callScope.from! }],
      expectedRelations: [],
    });
    if ("status" in result.accuracy) throw new Error("explicit audit Scope must be reviewed");
    expect(result.accuracy).toMatchObject({ tp: 0, fp: 1, fn: 0, unknown: 0 });
    expect(result.relationReview).toEqual([expect.objectContaining({ ...callScope, verdict: "FP" })]);
  });
});

afterAll(async () => {
  const output = process.env.CODECONTOUR_MEASUREMENT_OUTPUT;
  if (output) await writeFile(output, `${JSON.stringify({ reports: savedReports }, null, 2)}\n`, "utf8");
});

async function repositoryFixture(files: number, linesPerFile: number): Promise<{ root: string; expectedRelations: ResolutionMetricRelation[] }> {
  const root = await mkdtemp(join(tmpdir(), "code-contour-measurement-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] }), "utf8");
  for (let file = 0; file < files; file += 1) {
    const declarations = Array.from({ length: linesPerFile }, (_, line) => `export function f${file}_${line}() { return ${line}; }`).join("\n");
    const extra = file === 0 ? "\nexport function callKnown() { return f0_0(); }\n({ run: () => {} })['run']();\n" : "\n";
    await writeFile(join(root, "src", `file-${file}.ts`), `${declarations}${extra}`, "utf8");
  }
  const firstFilePrefix = Array.from({ length: linesPerFile }, (_, line) => `export function f0_${line}() { return ${line}; }`).join("\n");
  const callKnownStart = firstFilePrefix.length + 1;
  return { root, expectedRelations: [
    { type: "CALLS", from: `callKnown@src/file-0.ts:${callKnownStart}`, to: "f0_0@src/file-0.ts:0", resolution: "RESOLVED", syntaxCategory: "CALL" },
    { type: "REFERENCE_VALUE", from: `callKnown@src/file-0.ts:${callKnownStart}`, to: "f0_0@src/file-0.ts:0", resolution: "RESOLVED", syntaxCategory: "VALUE" },
    { type: "CALLS", from: "<file>@src/file-0.ts:0", resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS", syntaxCategory: "CALL" },
  ] };
}
