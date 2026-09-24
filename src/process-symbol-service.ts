import type { AnalyzerSymbol } from "./symbol-index.js";
import type { ProcessSymbolLink, SelectedProject, UserModel, UserModelStore } from "./feature-service.js";

export type LinkProcessSymbolResult =
  | { ok: true; created: boolean; link: ProcessSymbolLink }
  | { ok: false; error: { code: "PROJECT_NOT_READY" | "PROCESS_NOT_FOUND" | "SOURCE_NAVIGATION_UNAVAILABLE" | "SYMBOL_NOT_INDEXED" } };

export class ProcessSymbolService {
  constructor(private readonly store: UserModelStore, private readonly project: SelectedProject, private readonly indexedSymbols: readonly AnalyzerSymbol[]) {}
  async load(): Promise<UserModel> { return this.store.load(); }
  async link(input: { processId: string; targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN"; symbol: AnalyzerSymbol }): Promise<LinkProcessSymbolResult> {
    if (!this.project.repositoryLoaded) return { ok: false, error: { code: "PROJECT_NOT_READY" } };
    if (input.targetScope !== "PROJECT" || !isNavigable(input.symbol)) return { ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } };
    const indexedSymbol = this.indexedSymbols.find((symbol) => symbol.id === input.symbol.id && symbol.relativePath === input.symbol.relativePath
      && symbol.range.start === input.symbol.range.start && symbol.range.end === input.symbol.range.end);
    if (!indexedSymbol) return { ok: false, error: { code: "SYMBOL_NOT_INDEXED" } };
    const model = await this.store.load();
    if (!model.processes.some((process) => process.id === input.processId)) return { ok: false, error: { code: "PROCESS_NOT_FOUND" } };
    const link: ProcessSymbolLink = { processId: input.processId, symbolId: indexedSymbol.id, name: indexedSymbol.name, kind: indexedSymbol.kind, qualifiedName: indexedSymbol.qualifiedName, relativePath: indexedSymbol.relativePath, range: indexedSymbol.range };
    const existing = model.processSymbolLinks.find((candidate) => candidate.processId === link.processId && candidate.symbolId === link.symbolId);
    if (existing) return { ok: true, created: false, link: existing };
    await this.store.save({ ...model, processSymbolLinks: [...model.processSymbolLinks, link] });
    return { ok: true, created: true, link };
  }
}
function isNavigable(symbol: AnalyzerSymbol): boolean { return symbol.relativePath !== "" && !symbol.relativePath.startsWith("/") && !symbol.relativePath.startsWith("../") && !symbol.relativePath.includes("node_modules/") && symbol.range.start >= 0 && symbol.range.end > symbol.range.start; }
export function processSymbolViewItems(model: UserModel, processId: string): ProcessSymbolLink[] { return model.processSymbolLinks.filter((link) => link.processId === processId); }
export function symbolDefinitionLocation(link: ProcessSymbolLink | undefined): { relativePath: string; range: { start: number; end: number } } | undefined { return link && { relativePath: link.relativePath, range: link.range }; }
