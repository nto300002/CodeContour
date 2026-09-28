import type { DataFlow, Feature, Process, ProcessSymbolLink, UserModel, UserModelStore } from "./feature-service.js";
import type { SqliteDriver, SqliteMigration } from "./sqlite-driver.js";

const domainMigration: SqliteMigration = { version: 2, sql: `
  CREATE TABLE project_repository (project_id TEXT PRIMARY KEY REFERENCES project(id), repository_root TEXT NOT NULL, tsconfig_path TEXT NOT NULL);
  CREATE TABLE feature (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE, name TEXT NOT NULL, origin TEXT NOT NULL, confirmation TEXT NOT NULL);
  CREATE TABLE process (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE, feature_id TEXT NOT NULL REFERENCES feature(id) ON DELETE CASCADE, name TEXT NOT NULL, origin TEXT NOT NULL, confirmation TEXT NOT NULL);
  CREATE TABLE process_step (id TEXT PRIMARY KEY, process_id TEXT NOT NULL REFERENCES process(id) ON DELETE CASCADE, name TEXT NOT NULL, sort_order INTEGER NOT NULL);
  CREATE TABLE process_symbol_link (process_id TEXT NOT NULL REFERENCES process(id) ON DELETE CASCADE, symbol_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, qualified_name TEXT NOT NULL, relative_path TEXT NOT NULL, range_start INTEGER NOT NULL, range_end INTEGER NOT NULL, PRIMARY KEY (process_id, symbol_id));
  CREATE TABLE data_flow (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE, feature_id TEXT NOT NULL REFERENCES feature(id), from_process_id TEXT NOT NULL REFERENCES process(id), to_process_id TEXT NOT NULL REFERENCES process(id), label TEXT NOT NULL, verification TEXT NOT NULL);
  CREATE TABLE data_flow_evidence (data_flow_id TEXT NOT NULL REFERENCES data_flow(id) ON DELETE CASCADE, symbol_id TEXT NOT NULL, process_id TEXT NOT NULL REFERENCES process(id), name TEXT NOT NULL, kind TEXT NOT NULL, qualified_name TEXT NOT NULL, relative_path TEXT NOT NULL, range_start INTEGER NOT NULL, range_end INTEGER NOT NULL, PRIMARY KEY (data_flow_id, symbol_id));
  CREATE TABLE json_user_model_migration (project_id TEXT PRIMARY KEY REFERENCES project(id), applied_at TEXT NOT NULL);
` };

type FeatureRow = { id: string; name: string; origin: "USER"; confirmation: "CONFIRMED" };
type ProcessRow = FeatureRow & { feature_id: string };
type StepRow = { id: string; process_id: string; name: string; sort_order: number };
type LinkRow = { process_id: string; symbol_id: string; name: string; kind: string; qualified_name: string; relative_path: string; range_start: number; range_end: number };
type EvidenceRow = LinkRow & { data_flow_id: string };
type FlowRow = { id: string; feature_id: string; from_process_id: string; to_process_id: string; label: string; verification: "UNVERIFIED" | "EVIDENCED" };

/** Main-process-only SQLite adapter. JSON is deliberately not a production write target. */
export class SqliteUserModelStore implements UserModelStore {
  constructor(private readonly driver: SqliteDriver, private readonly projectId: string) { this.driver.applyMigrations([domainMigration]); }

  async load(): Promise<UserModel> {
    const features = this.driver.all<FeatureRow>("SELECT id, name, origin, confirmation FROM feature WHERE project_id = ? ORDER BY id", this.projectId);
    const processes = this.driver.all<ProcessRow>("SELECT id, feature_id, name, origin, confirmation FROM process WHERE project_id = ? ORDER BY id", this.projectId);
    const steps = this.driver.all<StepRow>("SELECT s.id, s.process_id, s.name, s.sort_order FROM process_step s JOIN process p ON p.id = s.process_id WHERE p.project_id = ? ORDER BY s.sort_order, s.id", this.projectId);
    const processLinks = this.links("process_symbol_link", "process_id IN (SELECT id FROM process WHERE project_id = ?)");
    const flows = this.driver.all<FlowRow>("SELECT id, feature_id, from_process_id, to_process_id, label, verification FROM data_flow WHERE project_id = ? ORDER BY id", this.projectId);
    const evidence = this.driver.all<EvidenceRow>("SELECT data_flow_id, process_id, symbol_id, name, kind, qualified_name, relative_path, range_start, range_end FROM data_flow_evidence WHERE data_flow_id IN (SELECT id FROM data_flow WHERE project_id = ?)", this.projectId);
    return {
      version: 1, projectId: this.projectId,
      features: features.map((row) => ({ id: row.id, name: row.name, origin: row.origin, confirmation: row.confirmation })),
      processes: processes.map((row) => ({ id: row.id, featureId: row.feature_id, name: row.name, origin: row.origin, confirmation: row.confirmation, steps: steps.filter((step) => step.process_id === row.id).map((step) => ({ id: step.id, name: step.name, order: step.sort_order })) })),
      processSymbolLinks: processLinks,
      dataFlows: flows.map((row) => ({ id: row.id, featureId: row.feature_id, fromProcessId: row.from_process_id, toProcessId: row.to_process_id, label: row.label, verification: row.verification, evidence: evidence.filter((link) => link.data_flow_id === row.id).map((link) => this.linkFromRow(link)) })),
    };
  }

  async save(model: UserModel): Promise<void> {
    this.assertModel(model);
    this.driver.transaction(() => this.writeModel(model));
  }

  hasJsonMigration(): boolean { return this.driver.get("SELECT 1 AS found FROM json_user_model_migration WHERE project_id = ?", this.projectId) !== undefined; }
  project(): string { return this.projectId; }
  markJsonMigration(): void { this.driver.run("INSERT INTO json_user_model_migration (project_id, applied_at) VALUES (?, ?)", this.projectId, new Date().toISOString()); }
  importLegacyJson(model: UserModel): boolean {
    this.assertModel(model);
    return this.driver.transaction(() => {
      if (this.hasJsonMigration()) return false;
      this.writeModel(model);
      this.markJsonMigration();
      return true;
    });
  }

  private links(table: "process_symbol_link" | "data_flow_evidence", where: string): ProcessSymbolLink[] {
    return this.driver.all<LinkRow>(`SELECT process_id, symbol_id, name, kind, qualified_name, relative_path, range_start, range_end FROM ${table} WHERE ${where}`, this.projectId).map((row) => this.linkFromRow(row));
  }
  private linkFromRow(row: LinkRow): ProcessSymbolLink { return { processId: row.process_id, symbolId: row.symbol_id, name: row.name, kind: row.kind, qualifiedName: row.qualified_name, relativePath: row.relative_path, range: { start: row.range_start, end: row.range_end } }; }
  private writeModel(model: UserModel): void {
    this.driver.run("DELETE FROM data_flow_evidence WHERE data_flow_id IN (SELECT id FROM data_flow WHERE project_id = ?)", this.projectId);
    this.driver.run("DELETE FROM data_flow WHERE project_id = ?", this.projectId);
    this.driver.run("DELETE FROM process_symbol_link WHERE process_id IN (SELECT id FROM process WHERE project_id = ?)", this.projectId);
    this.driver.run("DELETE FROM process_step WHERE process_id IN (SELECT id FROM process WHERE project_id = ?)", this.projectId);
    this.driver.run("DELETE FROM process WHERE project_id = ?", this.projectId);
    this.driver.run("DELETE FROM feature WHERE project_id = ?", this.projectId);
    for (const feature of model.features) this.driver.run("INSERT INTO feature (id, project_id, name, origin, confirmation) VALUES (?, ?, ?, ?, ?)", feature.id, this.projectId, feature.name, feature.origin, feature.confirmation);
    for (const process of model.processes) {
      this.driver.run("INSERT INTO process (id, project_id, feature_id, name, origin, confirmation) VALUES (?, ?, ?, ?, ?, ?)", process.id, this.projectId, process.featureId, process.name, process.origin, process.confirmation);
      for (const step of process.steps) this.driver.run("INSERT INTO process_step (id, process_id, name, sort_order) VALUES (?, ?, ?, ?)", step.id, process.id, step.name, step.order);
    }
    for (const link of model.processSymbolLinks) this.insertLink("process_symbol_link", link);
    for (const flow of model.dataFlows) {
      this.driver.run("INSERT INTO data_flow (id, project_id, feature_id, from_process_id, to_process_id, label, verification) VALUES (?, ?, ?, ?, ?, ?, ?)", flow.id, this.projectId, flow.featureId, flow.fromProcessId, flow.toProcessId, flow.label, flow.verification);
      for (const link of flow.evidence) this.insertLink("data_flow_evidence", link, flow.id);
    }
  }
  private insertLink(table: "process_symbol_link" | "data_flow_evidence", link: ProcessSymbolLink, flowId?: string): void {
    if (table === "process_symbol_link") this.driver.run("INSERT INTO process_symbol_link (process_id, symbol_id, name, kind, qualified_name, relative_path, range_start, range_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", link.processId, link.symbolId, link.name, link.kind, link.qualifiedName, link.relativePath, link.range.start, link.range.end);
    else this.driver.run("INSERT INTO data_flow_evidence (data_flow_id, symbol_id, process_id, name, kind, qualified_name, relative_path, range_start, range_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", flowId!, link.symbolId, link.processId, link.name, link.kind, link.qualifiedName, link.relativePath, link.range.start, link.range.end);
  }
  private assertModel(model: UserModel): void {
    if (model.projectId !== this.projectId) throw new Error("User model belongs to another Project");
    const features = new Set(model.features.map((feature) => feature.id)); const processes = new Set(model.processes.map((process) => process.id));
    if (features.size !== model.features.length || processes.size !== model.processes.length) throw new Error("Duplicate domain id");
    if (model.processes.some((process) => !features.has(process.featureId))) throw new Error("Process references an unknown Feature");
    if (model.processSymbolLinks.some((link) => !processes.has(link.processId))) throw new Error("Symbol Link references an unknown Process");
    if (model.dataFlows.some((flow) => !features.has(flow.featureId) || !processes.has(flow.fromProcessId) || !processes.has(flow.toProcessId))) throw new Error("Data Flow references an unknown domain object");
    if (model.dataFlows.some((flow) => flow.evidence.some((link) => !processes.has(link.processId)))) throw new Error("Evidence references an unknown Process");
  }
}

/** One-way, idempotent import of legacy JSON. Production writes remain SQLite-only. */
export async function migrateJsonUserModel(store: SqliteUserModelStore, model: UserModel): Promise<{ migrated: boolean }> {
  return { migrated: store.importLegacyJson(model) };
}
