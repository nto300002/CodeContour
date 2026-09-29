import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeCalls, type CallRelation } from "./call-analyzer.js";
import { analyzeImportRelations, type ImportRelation } from "./relation-analyzer.js";
import { analyzeStaticReferences, type StaticReference } from "./reference-analyzer.js";
import { loadTypeScriptProject } from "./repository-reader.js";
import { createSymbolIndex } from "./symbol-index.js";
import { evaluateResolutionMetrics, type ResolutionMetricRelation } from "./relation-resolution.js";

export interface AnalysisMeasurement {
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  metrics: { loc: number; fileCount: number; indexTimeMs: number; analysisTimeMs: number; processMaxRSSBytes: number; symbolCount: number; relationCount: number; unknownCount: number };
  environment: { nodeVersion: string; platform: string; memoryMeasurement: "PROCESS_MAX_RSS_SINCE_START" };
  partialFailures: Array<{ stage: "SYMBOL_INDEX" | "IMPORTS" | "REFERENCES" | "CALLS"; files?: string[]; message?: string }>;
  accuracy: ReturnType<typeof evaluateResolutionMetrics> | { status: "UNREVIEWED" };
  relationReview: Array<ResolutionMetricRelation & { verdict: "TP" | "FP" | "FN" | "UNKNOWN" }>;
}

export interface RelationAuditScope {
  type: string;
  from: string;
}

export async function measureTypeScriptProject(input: { repositoryRoot: string; tsconfigPath: string; auditScopes?: readonly RelationAuditScope[]; expectedRelations?: readonly ResolutionMetricRelation[] }): Promise<AnalysisMeasurement> {
  const startedAt = performance.now();
  const project = await loadTypeScriptProject(input);
  if (!project.ok) return { status: "FAILED", metrics: emptyMetrics(), environment: environment(), partialFailures: [{ stage: "SYMBOL_INDEX", message: project.error.message }], accuracy: evaluateResolutionMetrics([], []), relationReview: [] };

  const loc = await countLines(input.repositoryRoot, project.files);
  const indexStartedAt = performance.now();
  const index = await createSymbolIndex(input);
  const indexTimeMs = Math.round(performance.now() - indexStartedAt);
  const [imports, references, calls] = await Promise.all([analyzeImportRelations(input), analyzeStaticReferences(input), analyzeCalls(input)]);
  const partialFailures: AnalysisMeasurement["partialFailures"] = [];
  if (!index.ok) partialFailures.push({ stage: "SYMBOL_INDEX", message: index.error.message });
  else if (index.filesWithParseErrors.length) partialFailures.push({ stage: "SYMBOL_INDEX", files: index.filesWithParseErrors });
  if (!imports.ok) partialFailures.push({ stage: "IMPORTS", message: imports.error.message });
  if (!references.ok) partialFailures.push({ stage: "REFERENCES", message: references.error.message });
  if (!calls.ok) partialFailures.push({ stage: "CALLS", message: calls.error.message });

  const importRelations = imports.ok ? imports.relations : [];
  const referenceRelations = references.ok ? references.references : [];
  const callRelations = calls.ok ? calls.calls : [];
  const actualRelations = toMetricRelations(importRelations, referenceRelations, callRelations);
  const expectedRelations = input.expectedRelations ?? [];
  const metrics = {
    loc,
    fileCount: project.files.length,
    indexTimeMs,
    analysisTimeMs: Math.round(performance.now() - startedAt),
    processMaxRSSBytes: process.resourceUsage().maxRSS * 1024,
    symbolCount: index.ok ? index.symbols.length : 0,
    relationCount: importRelations.length + referenceRelations.length + callRelations.length,
    unknownCount: countUnknown(importRelations, referenceRelations, callRelations),
  };
  const auditScopes = input.auditScopes ?? scopesFromExpectedRelations(input.expectedRelations);
  const reviewed = auditScopes !== undefined;
  const reviewedActual = reviewed ? actualRelations.filter((actual) => auditScopes.some((scope) => scope.type === actual.type && scope.from === actual.from)) : [];
  const accuracy = reviewed ? evaluateResolutionMetrics(expectedRelations, reviewedActual) : { status: "UNREVIEWED" as const };
  return { status: !index.ok ? "FAILED" : partialFailures.length ? "PARTIAL" : "COMPLETE", metrics, environment: environment(), partialFailures, accuracy, relationReview: reviewed ? reviewRelations(reviewedActual, expectedRelations) : [] };
}

export async function writeMeasurementReport(path: string, report: AnalysisMeasurement): Promise<void> {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function countLines(root: string, files: readonly string[]): Promise<number> {
  const contents = await Promise.all(files.map(async (file) => {
    try { return await readFile(resolve(root, file), "utf8"); } catch { return ""; }
  }));
  return contents.reduce((total, content) => total + (content ? content.split(/\r?\n/).length - 1 : 0), 0);
}
function countUnknown(imports: readonly ImportRelation[], references: readonly StaticReference[], calls: readonly CallRelation[]): number {
  return [...imports, ...references, ...calls].filter((relation) => relation.resolution === "UNKNOWN").length;
}
function emptyMetrics(): AnalysisMeasurement["metrics"] { return { loc: 0, fileCount: 0, indexTimeMs: 0, analysisTimeMs: 0, processMaxRSSBytes: 0, symbolCount: 0, relationCount: 0, unknownCount: 0 }; }
function environment(): AnalysisMeasurement["environment"] { return { nodeVersion: process.version, platform: process.platform, memoryMeasurement: "PROCESS_MAX_RSS_SINCE_START" }; }
function identity(value: { qualifiedName: string; relativePath: string; range: { start: number } }): string { return `${value.qualifiedName}@${value.relativePath}:${value.range.start}`; }
function scopesFromExpectedRelations(expectedRelations: readonly ResolutionMetricRelation[] | undefined): RelationAuditScope[] | undefined {
  if (expectedRelations === undefined) return undefined;
  return expectedRelations.map((relation) => ({ type: relation.type, from: relation.from ?? "" }));
}
function toMetricRelations(imports: readonly ImportRelation[], references: readonly StaticReference[], calls: readonly CallRelation[]): ResolutionMetricRelation[] {
  return [
    ...imports.map((relation) => ({ type: relation.type, from: relation.evidenceLocation.relativePath, to: relation.definition ? `${relation.definition.relativePath}:${relation.definition.range.start}` : relation.importedName, resolution: relation.resolution, reason: relation.reason, syntaxCategory: "IMPORT" })),
    ...references.map((relation) => ({ type: `REFERENCE_${relation.kind}`, from: identity(relation.from), to: identity(relation.to), resolution: relation.resolution, syntaxCategory: relation.kind })),
    ...calls.map((relation) => ({ type: relation.type, from: identity(relation.caller), to: relation.callee ? identity(relation.callee) : undefined, resolution: relation.resolution, reason: relation.reason, syntaxCategory: "CALL" })),
  ];
}
function reviewRelations(actual: readonly ResolutionMetricRelation[], expected: readonly ResolutionMetricRelation[]): Array<ResolutionMetricRelation & { verdict: "TP" | "FP" | "FN" | "UNKNOWN" }> {
  const remaining = [...expected];
  const review: Array<ResolutionMetricRelation & { verdict: "TP" | "FP" | "FN" | "UNKNOWN" }> = actual.map((relation) => {
    const expectedIndex = remaining.findIndex((candidate) => candidate.type === relation.type && candidate.from === relation.from && candidate.to === relation.to && candidate.resolution === relation.resolution && candidate.reason === relation.reason && candidate.syntaxCategory === relation.syntaxCategory);
    if (relation.resolution === "UNKNOWN") {
      if (expectedIndex !== -1) { remaining.splice(expectedIndex, 1); return { ...relation, verdict: "UNKNOWN" as const }; }
      return { ...relation, verdict: "FP" as const };
    }
    if (expectedIndex === -1) return { ...relation, verdict: "FP" as const };
    remaining.splice(expectedIndex, 1); return { ...relation, verdict: "TP" as const };
  });
  return [...review, ...remaining.map((relation) => ({ ...relation, verdict: "FN" as const }))];
}
