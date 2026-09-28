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

/** Main-owned MVP domain source of truth. Renderer receives projections only. */
export const repositorySettings = sqliteTable("project_repository", {
  projectId: text("project_id").primaryKey().references(() => projects.id),
  repositoryRoot: text("repository_root").notNull(),
  tsconfigPath: text("tsconfig_path").notNull(),
});

export const features = sqliteTable("feature", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  confirmation: text("confirmation").notNull(),
});

export const processes = sqliteTable("process", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  featureId: text("feature_id").notNull().references(() => features.id),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  confirmation: text("confirmation").notNull(),
});

export const processSteps = sqliteTable("process_step", {
  id: text("id").primaryKey(),
  processId: text("process_id").notNull().references(() => processes.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const processSymbolLinks = sqliteTable("process_symbol_link", {
  processId: text("process_id").notNull().references(() => processes.id),
  symbolId: text("symbol_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  qualifiedName: text("qualified_name").notNull(),
  relativePath: text("relative_path").notNull(),
  rangeStart: integer("range_start").notNull(),
  rangeEnd: integer("range_end").notNull(),
}, (table) => [primaryKey({ columns: [table.processId, table.symbolId] })]);

export const dataFlows = sqliteTable("data_flow", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  featureId: text("feature_id").notNull().references(() => features.id),
  fromProcessId: text("from_process_id").notNull().references(() => processes.id),
  toProcessId: text("to_process_id").notNull().references(() => processes.id),
  label: text("label").notNull(),
  verification: text("verification").notNull(),
});

export const dataFlowEvidence = sqliteTable("data_flow_evidence", {
  dataFlowId: text("data_flow_id").notNull().references(() => dataFlows.id),
  symbolId: text("symbol_id").notNull(),
  processId: text("process_id").notNull().references(() => processes.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  qualifiedName: text("qualified_name").notNull(),
  relativePath: text("relative_path").notNull(),
  rangeStart: integer("range_start").notNull(),
  rangeEnd: integer("range_end").notNull(),
}, (table) => [primaryKey({ columns: [table.dataFlowId, table.symbolId] })]);
