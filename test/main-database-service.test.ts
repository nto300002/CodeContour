import { describe, expect, it } from "vitest";
import { AnalysisBatchController } from "../src/analysis-batch-controller.js";
import { AnalysisBatchGate } from "../src/analysis-batch-gate.js";
import { MainDatabaseService } from "../src/main-database-service.js";
import { NodeSqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";

describe("MainDatabaseService", () => {
  it("is the only SQLite writer after Main accepts an executor batch", () => {
    const driver = new NodeSqliteDriver(":memory:");
    const database = new MainDatabaseService(new SqliteSnapshotService(driver));
    database.migrate();
    database.createProject("project", "active");
    database.startRun("project", "run-b", "staging-b");

    const gate = new AnalysisBatchGate("active");
    gate.begin({ analysisRunId: "run-b", stagingSnapshotId: "staging-b" });
    const controller = new AnalysisBatchController(gate, database);

    expect(controller.receiveFromExecutor({ type: "ANALYSIS_BATCH", batch: { analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 1, records: ["accepted"] } }))
      .toEqual({ accepted: true });
    expect(database.records("staging-b")).toEqual(["accepted"]);

    expect(controller.receiveFromExecutor({ type: "ANALYSIS_BATCH", batch: { analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 1, records: ["duplicate"] } }))
      .toEqual({ accepted: false, reason: "DUPLICATE_SEQUENCE" });
    expect(database.records("staging-b")).toEqual(["accepted"]);

    database.cancel("project", "run-b");
    gate.cancel("run-b");
    expect(controller.receiveFromExecutor({ type: "ANALYSIS_BATCH", batch: { analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 2, records: ["late"] } }))
      .toEqual({ accepted: false, reason: "RUN_CANCELLED" });
    expect(database.records("staging-b")).toEqual([]);
    expect(database.project("project")).toEqual({ activeSnapshotId: "active", currentRunId: null, currentStagingSnapshotId: null });

    database.startRun("project", "run-c", "staging-c");
    gate.begin({ analysisRunId: "run-c", stagingSnapshotId: "staging-c" });
    expect(controller.receiveFromExecutor({ type: "ANALYSIS_BATCH", batch: { analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 3, records: ["stale"] } }))
      .toEqual({ accepted: false, reason: "STALE_RUN" });
    expect(database.records("staging-c")).toEqual([]);
    driver.close();
  });

  it("rejects executor messages carrying a database capability", () => {
    const gate = new AnalysisBatchGate("active");
    const controller = new AnalysisBatchController(gate, { saveStaging: () => undefined });

    expect(controller.receiveFromExecutor({
      type: "ANALYSIS_BATCH",
      batch: { analysisRunId: "run", stagingSnapshotId: "staging", sequenceNumber: 1 },
      databasePath: "/private/project.db",
    })).toEqual({ accepted: false, reason: "EXECUTOR_WRITE_DENIED" });
  });
});
