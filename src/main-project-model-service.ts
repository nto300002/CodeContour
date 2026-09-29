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
  constructor(private readonly store: SqliteUserModelStore, private readonly symbols: readonly AnalyzerSymbol[] | (() => readonly AnalyzerSymbol[]), private readonly createId: () => string) {}

  load(): Promise<UserModel> { return this.store.load(); }
  createFeature(name: string) { return new FeatureService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.createId).createFeature(name); }
  createProcess(input: { featureId?: string; name: string; firstStepName: string }) { return new ProcessService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.createId).createProcess(input); }
  createDataFlow(input: { fromProcessId: string; toProcessId: string; label: string }) { return new DataFlowService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.currentSymbols(), this.createId).create(input); }
  addDataFlowEvidence(input: { dataFlowId: string; targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN"; symbol: AnalyzerSymbol }) { return new DataFlowService(this.store, { id: this.projectId(), repositoryLoaded: true }, this.currentSymbols(), this.createId).addEvidence(input); }

  async execute(command: ProjectModelCommand): Promise<{ ok: true } | { ok: false; error: { code: string } }> {
    let result: { ok: true } | { ok: false; error: { code: string } } = { ok: true };
    await this.store.update((model) => {
      switch (command.type) {
        case "feature.rename": {
          const feature = model.features.find((item) => item.id === command.featureId); const name = command.name.trim();
          if (!feature || !name) { result = { ok: false, error: { code: !feature ? "FEATURE_NOT_FOUND" : "NAME_REQUIRED" } }; return model; }
          return { ...model, features: model.features.map((item) => item.id === feature.id ? { ...item, name } : item) };
        }
        case "feature.archive": {
          if (!model.features.some((item) => item.id === command.featureId)) { result = { ok: false, error: { code: "FEATURE_NOT_FOUND" } }; return model; }
          return { ...model, features: model.features.map((item) => item.id === command.featureId ? { ...item, lifecycle: "ARCHIVED" as const } : item) };
        }
        case "process.rename": {
          const name = command.name.trim(); if (!name) { result = { ok: false, error: { code: "NAME_REQUIRED" } }; return model; }
          if (!model.processes.some((item) => item.id === command.processId)) { result = { ok: false, error: { code: "PROCESS_NOT_FOUND" } }; return model; }
          return { ...model, processes: model.processes.map((item) => item.id === command.processId ? { ...item, name } : item) };
        }
        case "process.delete": {
          if (!model.processes.some((item) => item.id === command.processId)) { result = { ok: false, error: { code: "PROCESS_NOT_FOUND" } }; return model; }
          return { ...model, processes: model.processes.filter((item) => item.id !== command.processId), processSymbolLinks: model.processSymbolLinks.filter((item) => item.processId !== command.processId), dataFlows: model.dataFlows.filter((flow) => flow.fromProcessId !== command.processId && flow.toProcessId !== command.processId) };
        }
        case "process.move": {
          const process = model.processes.find((item) => item.id === command.processId); if (!process) { result = { ok: false, error: { code: "PROCESS_NOT_FOUND" } }; return model; }
          const ordered = model.processes.filter((item) => item.featureId === process.featureId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const index = ordered.findIndex((item) => item.id === process.id); const destination = index + command.direction;
          if (destination < 0 || destination >= ordered.length) { result = { ok: false, error: { code: "PROCESS_ORDER_UNCHANGED" } }; return model; }
          [ordered[index], ordered[destination]] = [ordered[destination], ordered[index]];
          const order = new Map(ordered.map((item, position) => [item.id, position]));
          return { ...model, processes: model.processes.map((item) => order.has(item.id) ? { ...item, order: order.get(item.id)! } : item) };
        }
        case "flow.rename": {
          const label = command.label.trim(); const flow = model.dataFlows.find((item) => item.id === command.dataFlowId);
          if (!flow || !label) { result = { ok: false, error: { code: !flow ? "DATA_FLOW_NOT_FOUND" : "LABEL_REQUIRED" } }; return model; }
          return { ...model, dataFlows: model.dataFlows.map((item) => item.id === flow.id ? { ...item, label } : item) };
        }
        case "flow.update-endpoints": {
          const flow = model.dataFlows.find((item) => item.id === command.dataFlowId); const from = model.processes.find((item) => item.id === command.fromProcessId); const to = model.processes.find((item) => item.id === command.toProcessId);
          if (!flow || !from || !to || from.id === to.id || from.featureId !== to.featureId || flow.featureId !== from.featureId) { result = { ok: false, error: { code: "INVALID_FLOW_ENDPOINTS" } }; return model; }
          return { ...model, dataFlows: model.dataFlows.map((item) => item.id === flow.id ? { ...item, fromProcessId: from.id, toProcessId: to.id, verification: "UNVERIFIED" as const, evidence: [] } : item) };
        }
        case "flow.delete": {
          if (!model.dataFlows.some((item) => item.id === command.dataFlowId)) { result = { ok: false, error: { code: "DATA_FLOW_NOT_FOUND" } }; return model; }
          return { ...model, dataFlows: model.dataFlows.filter((item) => item.id !== command.dataFlowId) };
        }
      }
    });
    return result;
  }

  private projectId(): string { return this.store.project(); }
  private currentSymbols(): readonly AnalyzerSymbol[] { return typeof this.symbols === "function" ? this.symbols() : this.symbols; }
}

export type ProjectModelCommand =
  | { type: "feature.rename"; featureId: string; name: string }
  | { type: "feature.archive"; featureId: string }
  | { type: "process.rename"; processId: string; name: string }
  | { type: "process.delete"; processId: string }
  | { type: "process.move"; processId: string; direction: -1 | 1 }
  | { type: "flow.rename"; dataFlowId: string; label: string }
  | { type: "flow.update-endpoints"; dataFlowId: string; fromProcessId: string; toProcessId: string }
  | { type: "flow.delete"; dataFlowId: string };
