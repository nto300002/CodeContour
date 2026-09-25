import { describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";

describe("SqliteSnapshotService", () => {
  it("promotes a complete Staging Snapshot atomically while preserving the prior Active Snapshot", () => {
    const driver = new NodeSqliteDriver(":memory:");
    const service = new SqliteSnapshotService(driver);
    service.migrate();
    service.createProject("project-1", "snapshot-a");
    service.startRun("project-1", "run-b", "snapshot-b");
    expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "snapshot-b", sequenceNumber: 1, records: ["symbol-b"] })).toEqual({ accepted: true });

    service.promote("project-1", "run-b");

    expect(service.project("project-1")).toEqual({ activeSnapshotId: "snapshot-b", currentRunId: null, currentStagingSnapshotId: null });
    expect(service.snapshotIds("project-1")).toEqual(["snapshot-a", "snapshot-b"]);
    expect(service.records("snapshot-b")).toEqual(["symbol-b"]);
    driver.close();
  });

  it("rejects duplicate, cancelled, and stale batches without writing them to another Run", () => {
    const driver = new NodeSqliteDriver(":memory:");
    const service = new SqliteSnapshotService(driver);
    service.migrate();
    service.createProject("project-1", "snapshot-a");
    service.startRun("project-1", "run-b", "snapshot-b");

    expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "snapshot-b", sequenceNumber: 1, records: ["first"] })).toEqual({ accepted: true });
    expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "snapshot-b", sequenceNumber: 1, records: ["duplicate"] })).toEqual({ accepted: false, reason: "DUPLICATE_SEQUENCE" });
    service.cancel("project-1", "run-b");
    expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "snapshot-b", sequenceNumber: 2, records: ["late"] })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });

    service.startRun("project-1", "run-c", "snapshot-c");
    expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "snapshot-b", sequenceNumber: 3, records: ["late-after-replacement"] })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });
    expect(service.acceptBatch({ analysisRunId: "run-c", stagingSnapshotId: "snapshot-c", sequenceNumber: 1, records: ["current"] })).toEqual({ accepted: true });
    service.promote("project-1", "run-c");
    service.startRun("project-1", "run-d", "snapshot-d");
    expect(service.acceptBatch({ analysisRunId: "run-c", stagingSnapshotId: "snapshot-c", sequenceNumber: 2, records: ["old"] })).toEqual({ accepted: false, reason: "STALE_RUN" });
    expect(service.records("snapshot-b")).toEqual([]);
    expect(service.records("snapshot-c")).toEqual(["current"]);
    driver.close();
  });

  it("keeps Active Snapshot intact and removes incomplete Staging Cache when a Run fails", () => {
    const driver = new NodeSqliteDriver(":memory:");
    const service = new SqliteSnapshotService(driver);
    service.migrate();
    service.createProject("project-1", "snapshot-a");
    service.startRun("project-1", "run-b", "snapshot-b");
    service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "snapshot-b", sequenceNumber: 1, records: ["incomplete"] });

    service.fail("project-1", "run-b");

    expect(service.project("project-1")).toEqual({ activeSnapshotId: "snapshot-a", currentRunId: null, currentStagingSnapshotId: null });
    expect(service.snapshotIds("project-1")).toEqual(["snapshot-a"]);
    driver.close();
  });
});
