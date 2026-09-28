import { randomUUID } from "node:crypto";
import { MainProjectModelService } from "./main-project-model-service.js";
import { BetterSqliteDriver } from "./sqlite-driver.js";
import { SqliteSnapshotService } from "./sqlite-snapshot-service.js";
import { SqliteUserModelStore } from "./sqlite-user-model-store.js";
import type { AnalyzerSymbol } from "./symbol-index.js";

/** Electron Main lifetime owner for the MVP SQLite Project model. */
export class MainProjectModelRuntime {
  private readonly driver: BetterSqliteDriver;
  private readonly snapshots: SqliteSnapshotService;
  private readonly symbolsByProject = new Map<string, readonly AnalyzerSymbol[]>();

  constructor(path: string) {
    this.driver = new BetterSqliteDriver(path);
    this.snapshots = new SqliteSnapshotService(this.driver);
    this.snapshots.migrate();
  }

  commands(projectId: string): MainProjectModelService {
    if (!this.snapshots.project(projectId)) this.snapshots.createProject(projectId, `active:${projectId}`);
    return new MainProjectModelService(new SqliteUserModelStore(this.driver, projectId), this.symbolsByProject.get(projectId) ?? [], randomUUID);
  }

  setCanonicalSymbols(projectId: string, symbols: readonly AnalyzerSymbol[]): void { this.symbolsByProject.set(projectId, symbols); }
  resolveProjectSymbol(projectId: string, symbolId: string): { targetScope: "PROJECT"; symbol: AnalyzerSymbol } | undefined {
    const symbol = this.symbolsByProject.get(projectId)?.find((candidate) => candidate.id === symbolId);
    return symbol && { targetScope: "PROJECT", symbol };
  }
  close(): void { this.driver.close(); }
}
