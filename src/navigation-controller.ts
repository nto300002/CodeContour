import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { CallRelation, CallSymbol } from "./call-analyzer.js";
import type { UserModel } from "./feature-service.js";
import type { AnalyzerSymbol } from "./symbol-index.js";

export interface SourceView { relativePath: string; range: { start: number; end: number }; text: string; }
export interface RelationViewItem {
  targetScope: CallRelation["targetScope"];
  resolution: CallRelation["resolution"];
  reason?: CallRelation["reason"];
  evidenceLocation: CallRelation["evidenceLocation"];
  target?: AnalyzerSymbol;
}
export interface NavigationState {
  selection: { featureId?: string; processId?: string; symbolId?: string };
  source?: SourceView;
  callers: RelationViewItem[];
  callees: RelationViewItem[];
  notice?: "SOURCE_UNAVAILABLE" | "SOURCE_NAVIGATION_UNAVAILABLE" | "SELECTION_UNAVAILABLE";
  canGoBack: boolean;
}

export class CodeNavigationController {
  private readonly root: string;
  private history: NavigationState[] = [];
  state: NavigationState = emptyState();

  constructor(private readonly input: { repositoryRoot: string; model: UserModel; symbols: readonly AnalyzerSymbol[]; calls: readonly CallRelation[] }) {
    this.root = realpathSync(input.repositoryRoot);
  }

  async selectFeature(featureId: string | undefined): Promise<NavigationState> {
    if (featureId !== undefined && !this.input.model.features.some((feature) => feature.id === featureId)) return this.unavailable();
    this.remember();
    this.state = { ...emptyState(), selection: featureId ? { featureId } : {}, canGoBack: this.history.length > 0 };
    return this.state;
  }

  async selectProcess(processId: string | undefined): Promise<NavigationState> {
    if (!processId) return this.selectFeature(this.state.selection.featureId);
    const process = this.input.model.processes.find((item) => item.id === processId);
    if (!process || !this.state.selection.featureId || process.featureId !== this.state.selection.featureId) return this.unavailable();
    this.remember();
    this.state = { ...emptyState(), selection: { featureId: process.featureId, processId }, canGoBack: this.history.length > 0 };
    return this.state;
  }

  async selectSymbol(symbolId: string): Promise<NavigationState> {
    const processId = this.state.selection.processId;
    if (!processId || !this.input.model.processSymbolLinks.some((link) => link.processId === processId && link.symbolId === symbolId)) return this.unavailable();
    return this.openSymbol(symbolId, true, this.state.selection.featureId, processId);
  }

  async selectDataFlowEvidence(dataFlowId: string, symbolId: string): Promise<NavigationState> {
    const featureId = this.state.selection.featureId;
    const flow = this.input.model.dataFlows.find((item) => item.id === dataFlowId && item.featureId === featureId);
    if (!flow || !flow.evidence.some((evidence) => evidence.symbolId === symbolId)) return this.unavailable();
    return this.openSymbol(symbolId, true, featureId);
  }

  async openRelation(relation: RelationViewItem): Promise<NavigationState> {
    if (relation.targetScope !== "PROJECT" || relation.resolution !== "RESOLVED" || !relation.target) {
      this.state = { ...this.state, notice: "SOURCE_NAVIGATION_UNAVAILABLE" };
      return this.state;
    }
    const processId = this.state.selection.processId;
    const keepsProcess = processId !== undefined && this.input.model.processSymbolLinks.some((link) => link.processId === processId && link.symbolId === relation.target!.id);
    return this.openSymbol(relation.target.id, true, this.state.selection.featureId, keepsProcess ? processId : undefined);
  }

  async back(): Promise<NavigationState> {
    const previous = this.history.pop();
    if (!previous) return this.state;
    this.state = { ...previous, canGoBack: this.history.length > 0 };
    return this.state;
  }

  private async openSymbol(symbolId: string, record: boolean, featureId = this.state.selection.featureId, processId?: string): Promise<NavigationState> {
    const symbol = this.input.symbols.find((candidate) => candidate.id === symbolId);
    if (!symbol) return this.unavailable();
    if (record) this.remember();
    const selection = { ...(featureId ? { featureId } : {}), ...(processId ? { processId } : {}), symbolId };
    const source = await this.sourceFor(symbol);
    this.state = {
      selection,
      source,
      callers: this.relationsFor(symbol, "CALLER"),
      callees: this.relationsFor(symbol, "CALLEE"),
      ...(source ? {} : { notice: "SOURCE_UNAVAILABLE" }),
      canGoBack: this.history.length > 0,
    };
    return this.state;
  }

  private relationsFor(symbol: AnalyzerSymbol, direction: "CALLER" | "CALLEE"): RelationViewItem[] {
    return this.input.calls.flatMap((relation) => {
      const selectedIsCaller = sameIdentity(symbol, relation.caller);
      const selectedIsCallee = relation.callee !== undefined && sameIdentity(symbol, relation.callee);
      if ((direction === "CALLER" && !selectedIsCallee) || (direction === "CALLEE" && !selectedIsCaller)) return [];
      const targetIdentity = direction === "CALLER" ? relation.caller : relation.callee;
      const target = targetIdentity && relation.targetScope === "PROJECT" && relation.resolution === "RESOLVED"
        ? this.input.symbols.find((candidate) => sameIdentity(candidate, targetIdentity)) : undefined;
      return [{ targetScope: relation.targetScope, resolution: relation.resolution, reason: relation.reason, evidenceLocation: relation.evidenceLocation, target }];
    });
  }

  private async sourceFor(symbol: AnalyzerSymbol): Promise<SourceView | undefined> {
    try {
      if (!isSafeRelativePath(symbol.relativePath)) return undefined;
      const fileName = realpathSync(resolve(this.root, symbol.relativePath));
      if (!isWithin(this.root, fileName)) return undefined;
      const text = await readFile(fileName, "utf8");
      if (symbol.range.start < 0 || symbol.range.end > text.length || symbol.range.end <= symbol.range.start) return undefined;
      return { relativePath: symbol.relativePath, range: symbol.range, text };
    } catch { return undefined; }
  }

  private remember(): void { this.history.push(this.state); }
  private unavailable(): NavigationState { this.state = { ...this.state, notice: "SELECTION_UNAVAILABLE" }; return this.state; }
}

function emptyState(): NavigationState { return { selection: {}, callers: [], callees: [], canGoBack: false }; }
function sameIdentity(symbol: Pick<AnalyzerSymbol, "qualifiedName" | "relativePath" | "range">, identity: CallSymbol): boolean {
  return symbol.qualifiedName === identity.qualifiedName && symbol.relativePath === identity.relativePath
    && symbol.range.start === identity.range.start && symbol.range.end === identity.range.end;
}
function isSafeRelativePath(path: string): boolean { return path !== "" && !path.startsWith("/") && !path.startsWith("../") && !path.includes("\\"); }
function isWithin(root: string, path: string): boolean { const pathFromRoot = relative(root, path); return pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !pathFromRoot.startsWith("../"); }
