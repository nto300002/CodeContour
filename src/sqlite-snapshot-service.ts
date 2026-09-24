import { type SqliteMigration, NodeSqliteDriver } from "./sqlite-driver.js";

export interface AnalyzerBatch {
  analysisRunId: string;
  stagingSnapshotId: string;
  sequenceNumber: number;
  records: string[];
}

export type BatchResult = { accepted: true } | { accepted: false; reason: "STALE_RUN" | "RUN_CANCELLED" | "DUPLICATE_SEQUENCE" };

const migrations: SqliteMigration[] = [{
  version: 1,
  sql: `
    CREATE TABLE project (id TEXT PRIMARY KEY, active_snapshot_id TEXT, current_run_id TEXT, current_staging_snapshot_id TEXT);
    CREATE TABLE snapshot (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE);
    CREATE TABLE analysis_run (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id), staging_snapshot_id TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE analysis_batch (analysis_run_id TEXT NOT NULL REFERENCES analysis_run(id), sequence_number INTEGER NOT NULL, PRIMARY KEY (analysis_run_id, sequence_number));
    CREATE TABLE analysis_record (snapshot_id TEXT NOT NULL REFERENCES snapshot(id) ON DELETE CASCADE, value TEXT NOT NULL);
  `,
}];

export class SqliteSnapshotService {
  constructor(private readonly driver: NodeSqliteDriver) {}

  migrate(): void {
    this.driver.applyMigrations(migrations);
  }

  createProject(projectId: string, activeSnapshotId: string): void {
    this.driver.transaction(() => {
      this.driver.run("INSERT INTO project (id, active_snapshot_id) VALUES (?, ?)", projectId, activeSnapshotId);
      this.driver.run("INSERT INTO snapshot (id, project_id) VALUES (?, ?)", activeSnapshotId, projectId);
    });
  }

  startRun(projectId: string, runId: string, stagingSnapshotId: string): void {
    this.driver.transaction(() => {
      const project = this.project(projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      if (project.currentRunId) {
        const previous = this.driver.get<{ status: string; staging_snapshot_id: string }>("SELECT status, staging_snapshot_id FROM analysis_run WHERE id = ?", project.currentRunId);
        if (previous?.status === "ANALYZING") throw new Error(`Run already active: ${project.currentRunId}`);
        this.driver.run("DELETE FROM snapshot WHERE id = ?", previous?.staging_snapshot_id ?? "");
      }
      this.driver.run("INSERT INTO snapshot (id, project_id) VALUES (?, ?)", stagingSnapshotId, projectId);
      this.driver.run("INSERT INTO analysis_run (id, project_id, staging_snapshot_id, status) VALUES (?, ?, ?, 'ANALYZING')", runId, projectId, stagingSnapshotId);
      this.driver.run("UPDATE project SET current_run_id = ?, current_staging_snapshot_id = ? WHERE id = ?", runId, stagingSnapshotId, projectId);
    });
  }

  acceptBatch(batch: AnalyzerBatch): BatchResult {
    const run = this.driver.get<{ project_id: string; staging_snapshot_id: string; status: string }>("SELECT project_id, staging_snapshot_id, status FROM analysis_run WHERE id = ?", batch.analysisRunId);
    if (run?.status === "CANCELLED") return { accepted: false, reason: "RUN_CANCELLED" };
    const project = run && this.project(run.project_id);
    if (!run || run.status !== "ANALYZING" || project?.currentRunId !== batch.analysisRunId || project.currentStagingSnapshotId !== batch.stagingSnapshotId || run.staging_snapshot_id !== batch.stagingSnapshotId) return { accepted: false, reason: "STALE_RUN" };
    if (this.driver.get("SELECT 1 AS found FROM analysis_batch WHERE analysis_run_id = ? AND sequence_number = ?", batch.analysisRunId, batch.sequenceNumber)) return { accepted: false, reason: "DUPLICATE_SEQUENCE" };
    this.driver.transaction(() => {
      this.driver.run("INSERT INTO analysis_batch (analysis_run_id, sequence_number) VALUES (?, ?)", batch.analysisRunId, batch.sequenceNumber);
      for (const value of batch.records) this.driver.run("INSERT INTO analysis_record (snapshot_id, value) VALUES (?, ?)", batch.stagingSnapshotId, value);
    });
    return { accepted: true };
  }

  cancel(projectId: string, runId: string): void {
    this.endWithoutPromotion(projectId, runId, "CANCELLED");
  }

  fail(projectId: string, runId: string): void {
    this.endWithoutPromotion(projectId, runId, "FAILED");
  }

  promote(projectId: string, runId: string): void {
    this.driver.transaction(() => {
      const run = this.driver.get<{ staging_snapshot_id: string; status: string }>("SELECT staging_snapshot_id, status FROM analysis_run WHERE id = ?", runId);
      const project = this.project(projectId);
      if (!run || run.status !== "ANALYZING" || project?.currentRunId !== runId || project.currentStagingSnapshotId !== run.staging_snapshot_id) throw new Error("Run is not promotable");
      this.driver.run("UPDATE analysis_run SET status = 'READY' WHERE id = ?", runId);
      this.driver.run("UPDATE project SET active_snapshot_id = ?, current_run_id = NULL, current_staging_snapshot_id = NULL WHERE id = ?", run.staging_snapshot_id, projectId);
    });
  }

  project(projectId: string): { activeSnapshotId: string | null; currentRunId: string | null; currentStagingSnapshotId: string | null } | undefined {
    const row = this.driver.get<{ active_snapshot_id: string | null; current_run_id: string | null; current_staging_snapshot_id: string | null }>("SELECT active_snapshot_id, current_run_id, current_staging_snapshot_id FROM project WHERE id = ?", projectId);
    return row && { activeSnapshotId: row.active_snapshot_id, currentRunId: row.current_run_id, currentStagingSnapshotId: row.current_staging_snapshot_id };
  }

  snapshotIds(projectId: string): string[] {
    return this.driver.all<{ id: string }>("SELECT id FROM snapshot WHERE project_id = ? ORDER BY id", projectId).map((snapshot) => snapshot.id);
  }

  records(snapshotId: string): string[] {
    return this.driver.all<{ value: string }>("SELECT value FROM analysis_record WHERE snapshot_id = ? ORDER BY rowid", snapshotId).map((record) => record.value);
  }

  private endWithoutPromotion(projectId: string, runId: string, status: "CANCELLED" | "FAILED"): void {
    this.driver.transaction(() => {
      const run = this.driver.get<{ staging_snapshot_id: string }>("SELECT staging_snapshot_id FROM analysis_run WHERE id = ?", runId);
      const project = this.project(projectId);
      if (!run || project?.currentRunId !== runId) throw new Error("Run is not current");
      this.driver.run("UPDATE analysis_run SET status = ? WHERE id = ?", status, runId);
      this.driver.run("DELETE FROM snapshot WHERE id = ?", run.staging_snapshot_id);
      this.driver.run("UPDATE project SET current_run_id = NULL, current_staging_snapshot_id = NULL WHERE id = ?", projectId);
    });
  }
}
