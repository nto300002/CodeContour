import type { AnalyzerSymbol } from "./symbol-index.js";
import type { DataFlow, ProcessSymbolLink, SelectedProject, UserModel, UserModelStore } from "./feature-service.js";
export class DataFlowService {
  constructor(private readonly store: UserModelStore, private readonly project: SelectedProject, private readonly symbols: readonly AnalyzerSymbol[], private readonly id: () => string) {}
  async load(): Promise<UserModel> { return this.store.load(); }
  async create(input: { fromProcessId: string; toProcessId: string; label: string }): Promise<{ ok: true; dataFlow: DataFlow } | { ok: false; error: { code: string } }> {
    if (!this.project.repositoryLoaded) return { ok: false, error: { code: "PROJECT_NOT_READY" } };
    if (input.fromProcessId === input.toProcessId) return { ok: false, error: { code: "PROCESS_MUST_DIFFER" } };
    const model = await this.store.load(); const from = model.processes.find((p) => p.id === input.fromProcessId); const to = model.processes.find((p) => p.id === input.toProcessId);
    if (!from || !to || from.featureId !== to.featureId) return { ok: false, error: { code: "PROCESS_NOT_FOUND" } };
    if (!input.label.trim()) return { ok: false, error: { code: "LABEL_REQUIRED" } };
    const dataFlow: DataFlow = { id: this.id(), featureId: from.featureId, fromProcessId: from.id, toProcessId: to.id, label: input.label.trim(), verification: "UNVERIFIED", evidence: [] };
    await this.store.save({ ...model, dataFlows: [...model.dataFlows, dataFlow] }); return { ok: true, dataFlow };
  }
  async addEvidence(input: { dataFlowId: string; targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN"; symbol: AnalyzerSymbol }): Promise<{ ok: true; created: boolean } | { ok: false; error: { code: string } }> {
    if (!this.project.repositoryLoaded) return { ok: false, error: { code: "PROJECT_NOT_READY" } };
    if (input.targetScope !== "PROJECT") return { ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } };
    const symbol = this.symbols.find((s) => s.id === input.symbol.id && s.relativePath === input.symbol.relativePath && s.range.start === input.symbol.range.start && s.range.end === input.symbol.range.end); if (!symbol) return { ok: false, error: { code: "SYMBOL_NOT_INDEXED" } };
    const model = await this.store.load(); const flow = model.dataFlows.find((f) => f.id === input.dataFlowId); if (!flow) return { ok: false, error: { code: "DATA_FLOW_NOT_FOUND" } };
    if (flow.evidence.some((e) => e.symbolId === symbol.id)) return { ok: true, created: false };
    const evidence: ProcessSymbolLink = { processId: flow.fromProcessId, symbolId: symbol.id, name: symbol.name, kind: symbol.kind, qualifiedName: symbol.qualifiedName, relativePath: symbol.relativePath, range: symbol.range };
    const updated = { ...flow, verification: "EVIDENCED" as const, evidence: [...flow.evidence, evidence] }; await this.store.save({ ...model, dataFlows: model.dataFlows.map((f) => f.id === flow.id ? updated : f) }); return { ok: true, created: true };
  }
}
export function dataFlowViewItems(model: UserModel, featureId: string) { return model.dataFlows.filter((flow) => flow.featureId === featureId).map((flow) => ({ id: flow.id, fromProcessId: flow.fromProcessId, toProcessId: flow.toProcessId, label: flow.label, verification: flow.verification, evidence: flow.evidence.map((item) => ({ name: item.name, kind: item.kind, relativePath: item.relativePath })) })); }
export function evidenceDefinitionLocation(evidence: ProcessSymbolLink | undefined) { return evidence && { relativePath: evidence.relativePath, range: evidence.range }; }
