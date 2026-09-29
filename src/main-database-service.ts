import { type BatchAcceptance } from "./analysis-batch-gate.js";
import { type ExecutorAnalysisBatch, type StagingSnapshotWriter } from "./analysis-batch-controller.js";
import { type BatchResult, SqliteSnapshotService } from "./sqlite-snapshot-service.js";

/**
 * Main-process-only persistence facade. It is the sole adapter from validated
 * executor batches to SQLite; utility processes receive no Driver or DB path.
 */
export class MainDatabaseService implements StagingSnapshotWriter {
  constructor(private readonly snapshots: SqliteSnapshotService) {}

  migrate(): void {
    this.snapshots.migrate();
  }

  createProject(projectId: string, activeSnapshotId: string): void {
    this.snapshots.createProject(projectId, activeSnapshotId);
  }

  startRun(projectId: string, runId: string, stagingSnapshotId: string): void {
    this.snapshots.startRun(projectId, runId, stagingSnapshotId);
  }

  cancel(projectId: string, runId: string): void {
    this.snapshots.cancel(projectId, runId);
  }

  fail(projectId: string, runId: string): void {
    this.snapshots.fail(projectId, runId);
  }

  promote(projectId: string, runId: string): void {
    this.snapshots.promote(projectId, runId);
  }

  saveStaging(batch: ExecutorAnalysisBatch): BatchAcceptance {
    return this.fromSnapshotResult(this.snapshots.acceptBatch({
      analysisRunId: batch.analysisRunId,
      stagingSnapshotId: batch.stagingSnapshotId,
      sequenceNumber: batch.sequenceNumber,
      records: [...(batch.records ?? [])],
    }));
  }

  records(snapshotId: string): string[] {
    return this.snapshots.records(snapshotId);
  }

  project(projectId: string) {
    return this.snapshots.project(projectId);
  }

  private fromSnapshotResult(result: BatchResult): BatchAcceptance {
    return result;
  }
}
