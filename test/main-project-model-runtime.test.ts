import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MainProjectModelRuntime } from "../src/main-project-model-runtime.js";

describe("MainProjectModelRuntime", () => {
  it("owns the SQLite database and resolves only indexed Project Symbols", async () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    runtime.setCanonicalSymbols("project-a", [{ id: "symbol-a", name: "validate", kind: "FUNCTION", qualifiedName: "validate", relativePath: "src/auth.ts", range: { start: 1, end: 2 }, signature: "" }]);
    expect(runtime.resolveProjectSymbol("project-a", "symbol-a")).toMatchObject({ targetScope: "PROJECT", symbol: { id: "symbol-a" } });
    expect(runtime.resolveProjectSymbol("project-a", "missing")).toBeUndefined();
    expect(await runtime.commands("project-a").createFeature("Authentication")).toMatchObject({ ok: true });
    expect((await runtime.commands("project-a").load()).features).toHaveLength(1);
    runtime.close();
  });

  it("serializes concurrent Feature additions so neither successful edit is lost", async () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    const commands = runtime.commands("project-concurrent");
    const results = await Promise.all([commands.createFeature("One"), commands.createFeature("Two")]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect((await commands.load()).features.map((feature) => feature.name).sort()).toEqual(["One", "Two"]);
    runtime.close();
  });

  it("serializes concurrent Process additions so neither successful edit is lost", async () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    const commands = runtime.commands("project-process-concurrent");
    const feature = await commands.createFeature("Feature");
    if (!feature.ok) throw new Error("Feature creation failed");
    const results = await Promise.all([
      commands.createProcess({ featureId: feature.feature.id, name: "One", firstStepName: "Start" }),
      commands.createProcess({ featureId: feature.feature.id, name: "Two", firstStepName: "Start" }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect((await commands.load()).processes.map((process) => process.name).sort()).toEqual(["One", "Two"]);
    runtime.close();
  });

  it("serializes concurrent Data Flow additions so neither successful edit is lost", async () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    const commands = runtime.commands("project-flow-concurrent");
    const feature = await commands.createFeature("Feature");
    if (!feature.ok) throw new Error("Feature creation failed");
    const first = await commands.createProcess({ featureId: feature.feature.id, name: "One", firstStepName: "Start" });
    const second = await commands.createProcess({ featureId: feature.feature.id, name: "Two", firstStepName: "Finish" });
    if (!first.ok || !second.ok) throw new Error("Process creation failed");
    const results = await Promise.all([
      commands.createDataFlow({ fromProcessId: first.process.id, toProcessId: second.process.id, label: "Flow One" }),
      commands.createDataFlow({ fromProcessId: first.process.id, toProcessId: second.process.id, label: "Flow Two" }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect((await commands.load()).dataFlows.map((flow) => flow.label).sort()).toEqual(["Flow One", "Flow Two"]);
    runtime.close();
  });

  it("uses the active Snapshot Symbol index for evidence after reopening the database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "code-contour-snapshot-symbols-"));
    const database = join(directory, "model.sqlite");
    const runtime = new MainProjectModelRuntime(database);
    runtime.configureRepository("project-symbol-reopen", "/workspace/repo", "tsconfig.json");
    const commands = runtime.commands("project-symbol-reopen");
    const featureResult = await commands.createFeature("Feature");
    if (!featureResult.ok) throw new Error("Feature creation failed");
    const first = await commands.createProcess({ featureId: featureResult.feature.id, name: "First", firstStepName: "Start" });
    const second = await commands.createProcess({ featureId: featureResult.feature.id, name: "Second", firstStepName: "Finish" });
    if (!first.ok || !second.ok) throw new Error("Process creation failed");
    const flow = await commands.createDataFlow({ fromProcessId: first.process.id, toProcessId: second.process.id, label: "Data" });
    if (!flow.ok) throw new Error("Data Flow creation failed");
    const symbol = { id: "src/auth.ts:0:FUNCTION" as const, kind: "FUNCTION" as const, name: "authenticate", qualifiedName: "authenticate", relativePath: "src/auth.ts", range: { start: 0, end: 20 }, signature: "" };
    runtime.beginAnalysisRun("project-symbol-reopen", "run-symbols", "staging-symbols");
    runtime.saveAnalysisBatch({ analysisRunId: "run-symbols", stagingSnapshotId: "staging-symbols", sequenceNumber: 0, records: [JSON.stringify(symbol)] });
    runtime.finishAnalysisRun("project-symbol-reopen", "run-symbols");
    runtime.close();

    const reopened = new MainProjectModelRuntime(database);
    const recoveredCommands = reopened.commands("project-symbol-reopen");
    const resolved = reopened.resolveProjectSymbol("project-symbol-reopen", symbol.id);
    expect(resolved?.symbol.id).toBe(symbol.id);
    const [evidenceResult, concurrentFeatureResult] = await Promise.all([
      recoveredCommands.addDataFlowEvidence({ dataFlowId: flow.dataFlow.id, targetScope: "PROJECT", symbol: resolved!.symbol }),
      recoveredCommands.createFeature("Concurrent feature"),
    ]);
    expect(evidenceResult).toMatchObject({ ok: true, created: true });
    expect(concurrentFeatureResult).toMatchObject({ ok: true });
    const persisted = await recoveredCommands.load();
    expect(persisted.features.map((item) => item.name)).toContain("Concurrent feature");
    expect(persisted.dataFlows.find((item) => item.id === flow.dataFlow.id)?.evidence).toMatchObject([{ symbolId: symbol.id }]);
    reopened.close();
  });

  it("imports legacy JSON once through Main and keeps later SQLite edits on repeat import", async () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    const legacy = { version: 1 as const, projectId: "project-migrate", features: [{ id: "legacy-feature", name: "Legacy", origin: "USER" as const, confirmation: "CONFIRMED" as const }], processes: [], processSymbolLinks: [], dataFlows: [] };
    expect(runtime.importLegacyUserModel("project-migrate", legacy)).toEqual({ migrated: true });
    await runtime.commands("project-migrate").createFeature("SQLite feature");
    expect(runtime.importLegacyUserModel("project-migrate", legacy)).toEqual({ migrated: false });
    expect((await runtime.commands("project-migrate").load()).features.map((feature) => feature.name).sort()).toEqual(["Legacy", "SQLite feature"]);
    runtime.close();
  });

  it("persists repository configuration alongside the Project in Main's SQLite database", () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    runtime.configureRepository("project-config", "/workspace/repo", "tsconfig.json");
    expect(runtime.repositoryConfiguration("project-config")).toEqual({ repositoryRoot: "/workspace/repo", tsconfigPath: "tsconfig.json" });
    expect(runtime.listProjects()).toEqual([{ id: "project-config", name: "repo", language: "TypeScript", updatedAt: "Saved", analysisStatus: "PENDING", connectionStatus: "DISCONNECTED", hasActiveSnapshot: false }]);
    expect(() => runtime.configureRepository("project-config", "", "tsconfig.json")).toThrow("required");
    runtime.close();
  });

  it("marks a Run interrupted by an application restart as retryable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "code-contour-interrupted-run-"));
    const database = join(directory, "model.sqlite");
    const first = new MainProjectModelRuntime(database);
    first.configureRepository("project-running", "/workspace/repo", "tsconfig.json");
    first.beginAnalysisRun("project-running", "run-incomplete", "staging-incomplete");
    first.close();

    const reopened = new MainProjectModelRuntime(database);
    expect(reopened.listProjects()).toMatchObject([{ id: "project-running", analysisStatus: "PENDING", hasActiveSnapshot: false }]);
    reopened.beginAnalysisRun("project-running", "run-retry", "staging-retry");
    reopened.close();
  });

  it("reads a legacy JSON file in Main and migrates it idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "code-contour-legacy-model-"));
    const file = join(root, "user-model.json");
    await writeFile(file, JSON.stringify({ version: 1, projectId: "project-json", features: [{ id: "feature-json", name: "Imported JSON", origin: "USER", confirmation: "CONFIRMED" }], processes: [], processSymbolLinks: [], dataFlows: [] }));
    const runtime = new MainProjectModelRuntime(":memory:");
    expect(await runtime.importLegacyJsonFile("project-json", file)).toEqual({ migrated: true });
    await runtime.commands("project-json").createFeature("After migration");
    expect(await runtime.importLegacyJsonFile("project-json", file)).toEqual({ migrated: false });
    expect((await runtime.commands("project-json").load()).features.map((feature) => feature.name).sort()).toEqual(["After migration", "Imported JSON"]);
    runtime.close();
  });
});
