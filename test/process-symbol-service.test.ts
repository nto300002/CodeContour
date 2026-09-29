import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureService, UserModelFileStore } from "../src/feature-service.js";
import { ProcessService } from "../src/process-service.js";
import { ProcessSymbolService, processSymbolViewItems, symbolDefinitionLocation } from "../src/process-symbol-service.js";
import { createSymbolIndex } from "../src/symbol-index.js";

const directories: string[] = [];
async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "code-contour-process-symbol-"));
  directories.push(root);
  await Promise.all(Object.entries(files).map(async ([path, contents]) => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), contents);
  }));
  return root;
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const readyProject = { id: "project-1", repositoryLoaded: true } as const;

describe("ProcessSymbolService", () => {
  it("links an indexed project symbol to a process, displays it, and navigates to its definition", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/auth.ts": "export function authenticate(token: string) { return token.length > 0; }" });
    const index = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(index).toMatchObject({ ok: true }); if (!index.ok) return;
    const symbol = index.symbols.find((candidate) => candidate.name === "authenticate")!;
    const store = new UserModelFileStore(join(root, "user-model.json"), "project-1");
    await new FeatureService(store, readyProject, () => "feature-1").createFeature("Authentication");
    const ids = ["process-1", "step-1"];
    await new ProcessService(store, readyProject, () => ids.shift()!).createProcess({ featureId: "feature-1", name: "Sign in", firstStepName: "Validate token" });
    const service = new ProcessSymbolService(store, readyProject, index.symbols);

    const result = await service.link({ processId: "process-1", targetScope: "PROJECT", symbol: {
      ...symbol, name: "fakeAdmin", kind: "CLASS", qualifiedName: "fakeAdmin",
    } });

    expect(result).toMatchObject({ ok: true, created: true, link: { processId: "process-1", symbolId: symbol.id, name: "authenticate", kind: "FUNCTION", relativePath: "src/auth.ts" } });
    expect(processSymbolViewItems(await service.load(), "process-1")).toEqual([expect.objectContaining({ name: "authenticate", kind: "FUNCTION", relativePath: "src/auth.ts" })]);
    expect(symbolDefinitionLocation(result.ok ? result.link : undefined)).toEqual({ relativePath: "src/auth.ts", range: symbol.range });
  });

  it("is idempotent for duplicate links and preserves the relation after reload", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/auth.ts": "export function authenticate() {}" });
    const index = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" }); if (!index.ok) return;
    const store = new UserModelFileStore(join(root, "user-model.json"), "project-1");
    await new FeatureService(store, readyProject, () => "feature-1").createFeature("Authentication");
    const ids = ["process-1", "step-1"];
    await new ProcessService(store, readyProject, () => ids.shift()!).createProcess({ featureId: "feature-1", name: "Sign in", firstStepName: "Start" });
    const service = new ProcessSymbolService(store, readyProject, index.symbols);
    const symbol = index.symbols[0]!;

    await service.link({ processId: "process-1", targetScope: "PROJECT", symbol });
    expect(await service.link({ processId: "process-1", targetScope: "PROJECT", symbol })).toMatchObject({ ok: true, created: false });
    expect((await new UserModelFileStore(join(root, "user-model.json"), "project-1").load()).processSymbolLinks).toHaveLength(1);
  });

  it("rejects missing processes and non-project symbols without saving a source anchor", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/auth.ts": "export function authenticate() {}" });
    const index = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" }); if (!index.ok) return;
    const store = new UserModelFileStore(join(root, "user-model.json"), "project-1");
    const service = new ProcessSymbolService(store, readyProject, index.symbols);
    const symbol = index.symbols[0]!;

    expect(await service.link({ processId: "missing", targetScope: "PROJECT", symbol })).toEqual({ ok: false, error: { code: "PROCESS_NOT_FOUND" } });
    await new FeatureService(store, readyProject, () => "feature-1").createFeature("Authentication");
    const ids = ["process-1", "step-1"];
    await new ProcessService(store, readyProject, () => ids.shift()!).createProcess({ featureId: "feature-1", name: "Sign in", firstStepName: "Start" });
    expect(await service.link({ processId: "process-1", targetScope: "EXTERNAL", symbol })).toEqual({ ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } });
    expect(await service.link({ processId: "process-1", targetScope: "UNKNOWN", symbol })).toEqual({ ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } });
    expect(await service.link({ processId: "process-1", targetScope: "PROJECT", symbol: { ...symbol, id: "forged", relativePath: "src/forged.ts" } })).toEqual({ ok: false, error: { code: "SYMBOL_NOT_INDEXED" } });
    expect((await service.load()).processSymbolLinks).toEqual([]);
  });
});
