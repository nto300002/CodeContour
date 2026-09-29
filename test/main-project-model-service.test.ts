import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { MainProjectModelService } from "../src/main-project-model-service.js";
import { NodeSqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";
import { SqliteUserModelStore } from "../src/sqlite-user-model-store.js";

describe("MainProjectModelService", () => {
  it("keeps concurrent edits and evidence updates in the SQLite model", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver); snapshots.migrate(); snapshots.createProject("project-concurrent", "active-concurrent");
    const symbol = { id: "symbol-concurrent", name: "authorize", kind: "FUNCTION" as const, qualifiedName: "authorize", relativePath: "src/auth.ts", range: { start: 1, end: 10 }, signature: "" };
    const ids = ["feature-concurrent", "process-from", "step-from", "process-to", "step-to", "flow-concurrent"];
    const commands = new MainProjectModelService(new SqliteUserModelStore(driver, "project-concurrent"), [symbol], () => ids.shift()!);
    await commands.createFeature("Auth");
    const featureId = (await commands.load()).features[0].id;
    const from = await commands.createProcess({ featureId, name: "Authenticate", firstStepName: "Check" });
    const to = await commands.createProcess({ featureId, name: "Create session", firstStepName: "Issue" });
    if (!from.ok || !to.ok) throw new Error("Process setup failed");
    const flow = await commands.createDataFlow({ fromProcessId: from.process.id, toProcessId: to.process.id, label: "token" });
    if (!flow.ok) throw new Error("Flow setup failed");

    await Promise.all([
      commands.execute({ type: "feature.rename", featureId, name: "User authentication" }),
      commands.addDataFlowEvidence({ dataFlowId: flow.dataFlow.id, targetScope: "PROJECT", symbol }),
    ]);

    const model = await commands.load();
    expect(model.features.find((feature) => feature.id === featureId)?.name).toBe("User authentication");
    expect(model.dataFlows.find((item) => item.id === flow.dataFlow.id)).toMatchObject({ verification: "EVIDENCED", evidence: [expect.objectContaining({ symbolId: symbol.id })] });
    driver.close();
  });

  it("writes Feature, Process, Data Flow, and Evidence through the Main SQLite command boundary", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver);
    snapshots.migrate(); snapshots.createProject("project-a", "active-a");
    const store = new SqliteUserModelStore(driver, "project-a");
    const ids = ["feature-a", "process-a", "step-a", "process-b", "step-b", "flow-a"];
    const symbol = { id: "symbol-a", name: "validateToken", kind: "FUNCTION" as const, qualifiedName: "validateToken", relativePath: "src/auth.ts", range: { start: 10, end: 30 }, signature: "" };
    const commands = new MainProjectModelService(store, [symbol], () => ids.shift()!);

    expect(await commands.createFeature("Authentication")).toMatchObject({ ok: true, feature: { id: "feature-a" } });
    expect(await commands.createProcess({ featureId: "feature-a", name: "Sign in", firstStepName: "Validate credentials" })).toMatchObject({ ok: true, process: { id: "process-a" } });
    expect(await commands.createProcess({ featureId: "feature-a", name: "Create session", firstStepName: "Issue token" })).toMatchObject({ ok: true, process: { id: "process-b" } });
    expect(await commands.createDataFlow({ fromProcessId: "process-a", toProcessId: "process-b", label: "session token" })).toMatchObject({ ok: true, dataFlow: { id: "flow-a", verification: "UNVERIFIED" } });
    expect(await commands.addDataFlowEvidence({ dataFlowId: "flow-a", targetScope: "PROJECT", symbol })).toEqual({ ok: true, created: true });

    expect(await commands.load()).toMatchObject({
      features: [{ id: "feature-a", name: "Authentication" }],
      processes: [expect.objectContaining({ id: "process-a" }), expect.objectContaining({ id: "process-b" })],
      dataFlows: [expect.objectContaining({ id: "flow-a", verification: "EVIDENCED", evidence: [expect.objectContaining({ symbolId: "symbol-a", relativePath: "src/auth.ts" })] })],
    });
    driver.close();
  });

  it("persists edits, ordering, and deletions through validated Main commands", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver); snapshots.migrate(); snapshots.createProject("project-b", "active-b");
    const commands = new MainProjectModelService(new SqliteUserModelStore(driver, "project-b"), [], randomUUID);
    await commands.createFeature("Payments");
    const first = await commands.createProcess({ featureId: "feature:unknown", name: "invalid", firstStepName: "step" });
    expect(first).toMatchObject({ ok: false });
    await commands.createFeature("Feature");
    const model = await commands.load();
    const featureId = model.features[0].id;
    const processA = await commands.createProcess({ featureId, name: "A", firstStepName: "A step" });
    const processB = await commands.createProcess({ featureId, name: "B", firstStepName: "B step" });
    if (!processA.ok || !processB.ok) throw new Error("Process setup failed");
    const flow = await commands.createDataFlow({ fromProcessId: processA.process.id, toProcessId: processB.process.id, label: "payload" });
    if (!flow.ok) throw new Error("Flow setup failed");
    expect(await commands.execute({ type: "feature.rename", featureId, name: "Renamed Feature" })).toEqual({ ok: true });
    expect(await commands.execute({ type: "feature.archive", featureId })).toEqual({ ok: true });
    expect(await commands.execute({ type: "process.move", processId: processB.process.id, direction: -1 })).toEqual({ ok: true });
    expect(await commands.execute({ type: "process.rename", processId: processA.process.id, name: "Renamed A" })).toEqual({ ok: true });
    expect(await commands.execute({ type: "flow.rename", dataFlowId: flow.dataFlow.id, label: "renamed payload" })).toEqual({ ok: true });
    expect(await commands.execute({ type: "flow.update-endpoints", dataFlowId: flow.dataFlow.id, fromProcessId: processB.process.id, toProcessId: processA.process.id })).toEqual({ ok: true });
    let saved = await commands.load();
    expect(saved.features[0].lifecycle).toBe("ARCHIVED");
    expect(saved.features[0].name).toBe("Renamed Feature");
    expect(saved.processes.map((process) => process.id)).toEqual([processB.process.id, processA.process.id]);
    expect(saved.processes[1].name).toBe("Renamed A");
    expect(saved.dataFlows[0]).toMatchObject({ label: "renamed payload", fromProcessId: processB.process.id, toProcessId: processA.process.id, verification: "UNVERIFIED", evidence: [] });
    expect(await commands.execute({ type: "process.delete", processId: processB.process.id })).toEqual({ ok: true });
    saved = await commands.load();
    expect(saved.processes.map((process) => process.id)).toEqual([processA.process.id]);
    expect(saved.dataFlows).toEqual([]);
    expect(await commands.execute({ type: "flow.update-endpoints", dataFlowId: "missing", fromProcessId: processA.process.id, toProcessId: processA.process.id })).toMatchObject({ ok: false });
    expect((await commands.load()).features[0].name).toBe("Renamed Feature");
    expect(snapshots.project("project-b")?.activeSnapshotId).toBe("active-b");
    driver.close();
  });
});
