import { describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";
import { SqliteUserModelStore, migrateJsonUserModel } from "../src/sqlite-user-model-store.js";

const model = {
  version: 1 as const,
  projectId: "project-a",
  features: [{ id: "feature-a", name: "Authentication", origin: "USER" as const, confirmation: "CONFIRMED" as const }],
  processes: [{ id: "process-a", featureId: "feature-a", name: "Sign in", origin: "USER" as const, confirmation: "CONFIRMED" as const, steps: [{ id: "step-a", name: "Validate", order: 0 }] }],
  processSymbolLinks: [{ processId: "process-a", symbolId: "symbol-a", name: "validateToken", kind: "FUNCTION", qualifiedName: "validateToken", relativePath: "src/auth.ts", range: { start: 10, end: 30 } }],
  dataFlows: [{ id: "flow-a", featureId: "feature-a", fromProcessId: "process-a", toProcessId: "process-a", label: "token", verification: "EVIDENCED" as const, evidence: [{ processId: "process-a", symbolId: "symbol-a", name: "validateToken", kind: "FUNCTION", qualifiedName: "validateToken", relativePath: "src/auth.ts", range: { start: 10, end: 30 } }] }],
};

describe("SqliteUserModelStore", () => {
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
});
