import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserModelFileStore, loadSelectedProject } from "../src/feature-service.js";
import { createSymbolIndex } from "../src/symbol-index.js";
import { DataFlowService, dataFlowViewItems, evidenceDefinitionLocation } from "../src/data-flow-service.js";

describe("DataFlowService", () => {
  it("creates a labelled flow and marks it evidenced after adding an indexed project symbol", async () => {
    const model = { version: 1 as const, projectId: "p", features: [{ id: "f", name: "Auth", origin: "USER" as const, confirmation: "CONFIRMED" as const }], processes: [
      { id: "a", featureId: "f", name: "A", origin: "USER" as const, confirmation: "CONFIRMED" as const, steps: [] },
      { id: "b", featureId: "f", name: "B", origin: "USER" as const, confirmation: "CONFIRMED" as const, steps: [] },
    ], processSymbolLinks: [], dataFlows: [] };
    const store = { load: async () => model, save: async (next: typeof model) => { Object.assign(model, next); } };
    const symbol = { id: "src:0:FUNCTION", name: "authenticate", kind: "FUNCTION" as const, qualifiedName: "authenticate", relativePath: "src/auth.ts", range: { start: 0, end: 20 }, signature: "" };
    const service = new DataFlowService(store, { id: "p", repositoryLoaded: true }, [symbol], (() => ["flow-1"].shift()!));
    const flow = await service.create({ fromProcessId: "a", toProcessId: "b", label: "token" });
    expect(flow).toMatchObject({ ok: true, dataFlow: { id: "flow-1", featureId: "f", label: "token", verification: "UNVERIFIED" } });
    if (!flow.ok) return;
    expect(await service.addEvidence({ dataFlowId: flow.dataFlow.id, targetScope: "PROJECT", symbol })).toMatchObject({ ok: true, created: true });
    expect((await service.load()).dataFlows[0]).toMatchObject({ verification: "EVIDENCED", evidence: [expect.objectContaining({ name: "authenticate", relativePath: "src/auth.ts" })] });
    expect(await service.addEvidence({ dataFlowId: flow.dataFlow.id, targetScope: "PROJECT", symbol })).toEqual({ ok: true, created: false });
    const saved = (await service.load()).dataFlows[0]!;
    expect(dataFlowViewItems(await service.load(), "f")).toEqual([expect.objectContaining({ verification: "EVIDENCED", label: "token" })]);
    expect(evidenceDefinitionLocation(saved.evidence[0])).toEqual({ relativePath: "src/auth.ts", range: symbol.range });
  });

  it("rejects self flows, missing processes, and external evidence", async () => {
    const model = { version: 1 as const, projectId: "p", features: [], processes: [], processSymbolLinks: [], dataFlows: [] };
    const store = { load: async () => model, save: async () => undefined };
    const symbol = { id: "x", name: "x", kind: "FUNCTION" as const, qualifiedName: "x", relativePath: "src/x.ts", range: { start: 0, end: 1 }, signature: "" };
    const service = new DataFlowService(store, { id: "p", repositoryLoaded: true }, [symbol], () => "flow");
    expect(await service.create({ fromProcessId: "a", toProcessId: "a", label: "x" })).toEqual({ ok: false, error: { code: "PROCESS_MUST_DIFFER" } });
    expect(await service.create({ fromProcessId: "a", toProcessId: "b", label: "x" })).toEqual({ ok: false, error: { code: "PROCESS_NOT_FOUND" } });
    expect(await service.addEvidence({ dataFlowId: "none", targetScope: "EXTERNAL", symbol })).toEqual({ ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } });
    expect(await service.addEvidence({ dataFlowId: "none", targetScope: "UNKNOWN", symbol })).toEqual({ ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } });
  });

  it("does not add evidence or save when the repository project is not loaded", async () => {
    const flow = { id: "flow", featureId: "f", fromProcessId: "a", toProcessId: "b", label: "token", verification: "UNVERIFIED" as const, evidence: [] };
    const model = { version: 1 as const, projectId: "p", features: [], processes: [], processSymbolLinks: [], dataFlows: [flow] };
    let saves = 0; const store = { load: async () => model, save: async () => { saves += 1; } };
    const symbol = { id: "s", name: "evidence", kind: "FUNCTION" as const, qualifiedName: "evidence", relativePath: "src/main.ts", range: { start: 0, end: 1 }, signature: "" };
    const service = new DataFlowService(store, { id: "p", repositoryLoaded: false }, [symbol], () => "unused");
    expect(await service.addEvidence({ dataFlowId: "flow", targetScope: "PROJECT", symbol })).toEqual({ ok: false, error: { code: "PROJECT_NOT_READY" } });
    expect(model.dataFlows[0]).toEqual(flow); expect(saves).toBe(0);
  });

  it("persists evidence after a Repository Reader-backed flow and normalizes legacy JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "code-contour-flow-"));
    try {
      await mkdir(join(root, "src")); await writeFile(join(root, "tsconfig.json"), JSON.stringify({ include: ["src"] })); await writeFile(join(root, "src/main.ts"), "export function evidence() {}");
      const project = await loadSelectedProject({ id: "p", repositoryRoot: root, tsconfigPath: "tsconfig.json" });
      const path = join(root, "user-model.json"); await writeFile(path, JSON.stringify({ version: 1, projectId: "p", features: [{ id: "f", name: "F", origin: "USER", confirmation: "CONFIRMED" }], processes: [{ id: "a", featureId: "f", name: "A", origin: "USER", confirmation: "CONFIRMED", steps: [] }, { id: "b", featureId: "f", name: "B", origin: "USER", confirmation: "CONFIRMED", steps: [] }], processSymbolLinks: [] }));
      const store = new UserModelFileStore(path, "p"); const index = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" }); if (!index.ok) throw new Error("index"); const symbol = index.symbols.find((candidate) => candidate.name === "evidence"); if (!symbol) throw new Error("symbol");
      expect((await store.load()).dataFlows).toEqual([]);
      const service = new DataFlowService(store, project, [symbol], () => "flow"); const flow = await service.create({ fromProcessId: "a", toProcessId: "b", label: "token" }); if (!flow.ok) throw new Error("flow"); await service.addEvidence({ dataFlowId: "flow", targetScope: "PROJECT", symbol });
      expect((await new UserModelFileStore(path, "p").load()).dataFlows).toMatchObject([{ label: "token", verification: "EVIDENCED", evidence: [{ name: "evidence" }] }]); expect(JSON.parse(await readFile(path, "utf8")).dataFlows).toHaveLength(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
