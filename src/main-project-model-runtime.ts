import { randomUUID } from "node:crypto";
import { MainProjectModelService } from "./main-project-model-service.js";
import { BetterSqliteDriver } from "./sqlite-driver.js";
import { SqliteSnapshotService } from "./sqlite-snapshot-service.js";
import { SqliteUserModelStore } from "./sqlite-user-model-store.js";
import { UserModelFileStore, type UserModel } from "./feature-service.js";
import type { AnalyzerSymbol } from "./symbol-index.js";
import type { AnalyzerBatch, BatchResult } from "./sqlite-snapshot-service.js";
import { basename } from "node:path";
import { existsSync } from "node:fs";

/** Electron Main lifetime owner for the MVP SQLite Project model. */
export class MainProjectModelRuntime {
  private readonly driver: BetterSqliteDriver;
  private readonly snapshots: SqliteSnapshotService;
  private readonly symbolsByProject = new Map<string, readonly AnalyzerSymbol[]>();

  constructor(path: string) {
    this.driver = new BetterSqliteDriver(path);
    this.snapshots = new SqliteSnapshotService(this.driver);
    this.snapshots.migrate();
    this.snapshots.failInterruptedRuns();
    // Apply domain schema before the first Project Hub query (which may be an empty database).
    new SqliteUserModelStore(this.driver, "__schema__");
  }

  commands(projectId: string): MainProjectModelService {
    if (!this.snapshots.project(projectId)) this.snapshots.createProject(projectId);
    return new MainProjectModelService(new SqliteUserModelStore(this.driver, projectId), () => {
      const project = this.snapshots.project(projectId);
      return project?.activeSnapshotId ? this.canonicalSymbols(projectId) : this.symbolsByProject.get(projectId) ?? [];
    }, randomUUID);
  }

  /** Main-only, idempotent migration entry point for a legacy JSON fixture/model. */
  importLegacyUserModel(projectId: string, model: UserModel): { migrated: boolean } {
    this.commands(projectId);
    const store = new SqliteUserModelStore(this.driver, projectId);
    return { migrated: store.importLegacyJson(model) };
  }

  async importLegacyJsonFile(projectId: string, filePath: string): Promise<{ migrated: boolean }> {
    const model = await new UserModelFileStore(filePath, projectId).load();
    return this.importLegacyUserModel(projectId, model);
  }

  configureRepository(projectId: string, repositoryRoot: string, tsconfigPath: string): void {
    if (!repositoryRoot.trim() || !tsconfigPath.trim()) throw new Error("Repository Root and tsconfig path are required.");
    this.commands(projectId);
    this.driver.transaction(() => this.driver.run("INSERT INTO project_repository (project_id, repository_root, tsconfig_path, project_name) VALUES (?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET repository_root = excluded.repository_root, tsconfig_path = excluded.tsconfig_path, project_name = excluded.project_name", projectId, repositoryRoot, tsconfigPath, basename(repositoryRoot)));
  }

  repositoryConfiguration(projectId: string): { repositoryRoot: string; tsconfigPath: string } | undefined {
    const row = this.driver.get<{ repository_root: string; tsconfig_path: string }>("SELECT repository_root, tsconfig_path FROM project_repository WHERE project_id = ?", projectId);
    return row && { repositoryRoot: row.repository_root, tsconfigPath: row.tsconfig_path };
  }

  listProjects(): Array<{ id: string; name: string; language: "TypeScript"; updatedAt: string; analysisStatus: "READY" | "PENDING"; connectionStatus: "CONNECTED" | "DISCONNECTED"; hasActiveSnapshot: boolean }> {
    const rows = this.driver.all<{ id: string; project_name: string; repository_root: string; active_snapshot_id: string | null }>("SELECT p.id, r.project_name, r.repository_root, p.active_snapshot_id FROM project p JOIN project_repository r ON r.project_id = p.id ORDER BY r.project_name, p.id");
    return rows.map((row) => ({ id: row.id, name: row.project_name || basename(row.repository_root), language: "TypeScript", updatedAt: "Saved", analysisStatus: row.active_snapshot_id ? "READY" : "PENDING", connectionStatus: existsSync(row.repository_root) ? "CONNECTED" : "DISCONNECTED", hasActiveSnapshot: row.active_snapshot_id !== null }));
  }

  repositoryConfigurationFor(projectId: string) { return this.repositoryConfiguration(projectId); }
  beginAnalysisRun(projectId: string, runId: string, stagingSnapshotId: string): void { this.snapshots.startRun(projectId, runId, stagingSnapshotId); }
  saveAnalysisBatch(batch: AnalyzerBatch): BatchResult { return this.snapshots.acceptBatch(batch); }
  finishAnalysisRun(projectId: string, runId: string): void { this.snapshots.promote(projectId, runId); }
  failAnalysisRun(projectId: string, runId: string): void { this.snapshots.fail(projectId, runId); }
  cancelAnalysisRun(projectId: string, runId: string): void { this.snapshots.cancel(projectId, runId); }
  beginAnalysis(projectId: string, runId: string, stagingSnapshotId: string): void { this.beginAnalysisRun(projectId, runId, stagingSnapshotId); }
  finishAnalysis(projectId: string, runId: string): void { this.finishAnalysisRun(projectId, runId); }
  failAnalysis(projectId: string, runId: string): void { this.failAnalysisRun(projectId, runId); }
  cancelAnalysis(projectId: string, runId: string): void { this.cancelAnalysisRun(projectId, runId); }

  setCanonicalSymbols(projectId: string, symbols: readonly AnalyzerSymbol[]): void { this.symbolsByProject.set(projectId, symbols); }
  resolveProjectSymbol(projectId: string, symbolId: string): { targetScope: "PROJECT"; symbol: AnalyzerSymbol } | undefined {
    const project = this.snapshots.project(projectId);
    const available = project?.activeSnapshotId ? this.canonicalSymbols(projectId) : this.symbolsByProject.get(projectId) ?? [];
    const symbol = available.find((candidate) => candidate.id === symbolId);
    return symbol && { targetScope: "PROJECT", symbol };
  }
  canonicalSymbols(projectId: string): readonly AnalyzerSymbol[] {
    const project = this.snapshots.project(projectId);
    if (!project?.activeSnapshotId) return [];
    return this.snapshots.records(project.activeSnapshotId).flatMap((record) => { try { const symbol = JSON.parse(record) as AnalyzerSymbol; return typeof symbol.id === "string" ? [symbol] : []; } catch { return []; } });
  }
  close(): void { this.driver.close(); }
}
