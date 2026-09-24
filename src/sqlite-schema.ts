import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Shared logical schema for both node:sqlite and better-sqlite3 candidates. */
export const projects = sqliteTable("project", {
  id: text("id").primaryKey(),
  activeSnapshotId: text("active_snapshot_id"),
  currentRunId: text("current_run_id"),
  currentStagingSnapshotId: text("current_staging_snapshot_id"),
});

export const snapshots = sqliteTable("snapshot", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
});

export const analysisRuns = sqliteTable("analysis_run", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  stagingSnapshotId: text("staging_snapshot_id").notNull(),
  status: text("status").notNull(),
});

export const analysisBatches = sqliteTable("analysis_batch", {
  analysisRunId: text("analysis_run_id").notNull().references(() => analysisRuns.id),
  sequenceNumber: integer("sequence_number").notNull(),
}, (table) => [primaryKey({ columns: [table.analysisRunId, table.sequenceNumber] })]);

export const analysisRecords = sqliteTable("analysis_record", {
  snapshotId: text("snapshot_id").notNull().references(() => snapshots.id),
  value: text("value").notNull(),
});
