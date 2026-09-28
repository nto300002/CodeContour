import { describe, expect, it } from "vitest";
import { MainProjectModelService } from "../src/main-project-model-service.js";
import { NodeSqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";
import { SqliteUserModelStore } from "../src/sqlite-user-model-store.js";

describe("MainProjectModelService", () => {
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
});
