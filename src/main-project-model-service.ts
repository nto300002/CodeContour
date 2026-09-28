import { DataFlowService } from "./data-flow-service.js";
import { FeatureService, type UserModel } from "./feature-service.js";
import { ProcessService } from "./process-service.js";
import { SqliteUserModelStore } from "./sqlite-user-model-store.js";
import type { AnalyzerSymbol } from "./symbol-index.js";

/**
 * Main-process command boundary for the mutable Project model. Renderer callers
 * receive projections/results only; they never receive a Store or SQLite Driver.
 */
export class MainProjectModelService {
  constructor(private readonly store: SqliteUserModelStore, private readonly symbols: readonly AnalyzerSymbol[], private readonly createId: () => string) {}

  load(): Promise<UserModel> { return this.store.load(); }
  createFeature(name: string) { return new FeatureService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.createId).createFeature(name); }
  createProcess(input: { featureId?: string; name: string; firstStepName: string }) { return new ProcessService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.createId).createProcess(input); }
  createDataFlow(input: { fromProcessId: string; toProcessId: string; label: string }) { return new DataFlowService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.symbols, this.createId).create(input); }
  addDataFlowEvidence(input: { dataFlowId: string; targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN"; symbol: AnalyzerSymbol }) { return new DataFlowService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.symbols, this.createId).addEvidence(input); }

  private projectId(): string { return this.store.project(); }
}
