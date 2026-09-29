import { describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";
import { SqliteUserModelStore, migrateJsonUserModel } from "../src/sqlite-user-model-store.js";

const model = {
  version: 1 as const,
  projectId: "project-a",
  features: [{ id: "feature-a", name: "Authentication", origin: "USER" as const, confirmation: "CONFIRMED" as const }],
  processes: [{ id: "process-a", featureId: "feature-a", name: "Sign in", origin: "USER" as const, confirmation: "CONFIRMED" as const, order: 0, steps: [{ id: "step-a", name: "Validate", order: 0 }] }],
  processSymbolLinks: [{ processId: "process-a", symbolId: "symbol-a", name: "validateToken", kind: "FUNCTION", qualifiedName: "validateToken", relativePath: "src/auth.ts", range: { start: 10, end: 30 } }],
  dataFlows: [{ id: "flow-a", featureId: "feature-a", fromProcessId: "process-a", toProcessId: "process-a", label: "token", verification: "EVIDENCED" as const, evidence: [{ processId: "process-a", symbolId: "symbol-a", name: "validateToken", kind: "FUNCTION", qualifiedName: "validateToken", relativePath: "src/auth.ts", range: { start: 10, end: 30 } }] }],
};

describe("SqliteUserModelStore", () => {
  it("preserves zero-based Process order for each Feature after loading", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver);
    snapshots.migrate();
    snapshots.createProject("project-a", "active-a");
    const store = new SqliteUserModelStore(driver, "project-a");
    const multipleFeatureModel = {
      ...model,
      features: [
        ...model.features,
        { id: "feature-b", name: "Payments", origin: "USER" as const, confirmation: "CONFIRMED" as const },
      ],
      processes: [
        { ...model.processes[0], steps: [], order: 0 },
        { ...model.processes[0], id: "process-b", featureId: "feature-b", name: "Charge", steps: [], order: 0 },
        { ...model.processes[0], id: "process-a-followup", name: "Verify session", steps: [], order: 1 },
      ],
    };

    await store.save(multipleFeatureModel);

    expect((await store.load()).processes.map(({ id, order }) => [id, order])).toEqual([
      ["process-a", 0],
      ["process-b", 0],
      ["process-a-followup", 1],
    ]);
    driver.close();
  });

  it("migrates a JSON model once and restores the same selectable model after reopening", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver);
    snapshots.migrate();
    snapshots.createProject("project-a", "active-a");
    const store = new SqliteUserModelStore(driver, "project-a");

    expect(await migrateJsonUserModel(store, model)).toEqual({ migrated: true });
    expect(await migrateJsonUserModel(store, model)).toEqual({ migrated: false });
    expect(await new SqliteUserModelStore(driver, "project-a").load()).toEqual(model);
    driver.close();
  });

  it("rolls back an invalid import and preserves the active snapshot and existing user model", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver);
    snapshots.migrate();
    snapshots.createProject("project-a", "active-a");
    const store = new SqliteUserModelStore(driver, "project-a");
    await store.save(model);

    await expect(store.save({ ...model, processes: [{ ...model.processes[0], featureId: "missing-feature" }] })).rejects.toThrow("unknown Feature");
    expect(await store.load()).toEqual(model);
    expect(snapshots.project("project-a")).toEqual({ activeSnapshotId: "active-a", currentRunId: null, currentStagingSnapshotId: null });
    driver.close();
  });

  it.each(["cancel", "fail"] as const)("preserves Active Snapshot and user-authored model when analysis %s", async (outcome) => {
    const driver = new NodeSqliteDriver(":memory:");
    const snapshots = new SqliteSnapshotService(driver);
    snapshots.migrate(); snapshots.createProject("project-a", "active-a");
    const store = new SqliteUserModelStore(driver, "project-a"); await store.save(model);
    snapshots.startRun("project-a", "run-a", "staging-a");
    snapshots.acceptBatch({ analysisRunId: "run-a", stagingSnapshotId: "staging-a", sequenceNumber: 0, records: ["partial analyzer data"] });
    snapshots[outcome]("project-a", "run-a");
    expect(snapshots.project("project-a")?.activeSnapshotId).toBe("active-a");
    expect(await store.load()).toEqual(model);
    driver.close();
  });
});
