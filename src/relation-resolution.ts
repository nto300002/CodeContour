export type ResolutionState = "RESOLVED" | "INFERRED" | "UNKNOWN";

export type ResolutionReason =
  | "DECLARATION_OVERLOAD"
  | "DECLARED_INTERFACE_MEMBER"
  | "DYNAMIC_PROPERTY_ACCESS"
  | "MISSING_EXPORT"
  | "MISSING_INFERENCE_EVIDENCE"
  | "UNRESOLVED_ALIAS"
  | "UNRESOLVED_CALL_SIGNATURE"
  | "UNRESOLVED_SYMBOL"
  | "UNSUPPORTED_SYNTAX";

export interface ResolutionClassification {
  resolution: ResolutionState;
  reason?: ResolutionReason;
  inferenceEvidence?: string;
}

const inferenceReasons = new Set<ResolutionReason>([
  "DECLARED_INTERFACE_MEMBER",
  "DECLARATION_OVERLOAD",
]);

export function classifyResolution(input: {
  confirmed?: boolean;
  inference?: { reason: ResolutionReason; evidence: string };
  unknownReason?: ResolutionReason;
}): ResolutionClassification {
  if (input.confirmed) return { resolution: "RESOLVED" };
  if (input.inference) {
    if (!input.inference.evidence.trim()) return { resolution: "UNKNOWN", reason: "MISSING_INFERENCE_EVIDENCE" };
    if (inferenceReasons.has(input.inference.reason)) return {
      resolution: "INFERRED",
      reason: input.inference.reason,
      inferenceEvidence: input.inference.evidence,
    };
    return { resolution: "UNKNOWN", reason: input.inference.reason };
  }
  return { resolution: "UNKNOWN", reason: input.unknownReason ?? "UNRESOLVED_SYMBOL" };
}

export function summarizeResolutions(relations: Array<Pick<ResolutionClassification, "resolution" | "reason">>) {
  const byResolution: Record<ResolutionState, number> = { RESOLVED: 0, INFERRED: 0, UNKNOWN: 0 };
  const byReason: Partial<Record<ResolutionReason, number>> = {};
  for (const relation of relations) {
    byResolution[relation.resolution] += 1;
    if (relation.reason) byReason[relation.reason] = (byReason[relation.reason] ?? 0) + 1;
  }
  return { total: relations.length, byResolution, byReason };
}

export interface ResolutionMetricRelation extends Pick<ResolutionClassification, "resolution" | "reason"> {
  type: string;
  from?: string;
  to?: string;
  syntaxCategory: string;
}

export function evaluateResolutionMetrics(expected: readonly ResolutionMetricRelation[], actual: readonly ResolutionMetricRelation[]) {
  const usedActual = new Set<number>();
  const bySyntaxCategory: Record<string, number> = {};
  const byReason: Partial<Record<ResolutionReason, number>> = {};
  let tp = 0; let fp = 0; let fn = 0; let unknown = 0;
  const count = (relation: ResolutionMetricRelation) => {
    bySyntaxCategory[relation.syntaxCategory] = (bySyntaxCategory[relation.syntaxCategory] ?? 0) + 1;
    if (relation.reason) byReason[relation.reason] = (byReason[relation.reason] ?? 0) + 1;
  };
  for (const wanted of expected) {
    const found = actual.findIndex((observed, index) => !usedActual.has(index)
      && observed.type === wanted.type && observed.from === wanted.from && observed.to === wanted.to
      && observed.resolution === wanted.resolution && observed.reason === wanted.reason
      && observed.syntaxCategory === wanted.syntaxCategory);
    if (found === -1) { fn += 1; count(wanted); continue; }
    usedActual.add(found); count(wanted);
    if (wanted.resolution === "UNKNOWN") unknown += 1; else tp += 1;
  }
  actual.forEach((observed, index) => {
    if (!usedActual.has(index)) { fp += 1; count(observed); }
  });
  return { tp, fp, fn, unknown, bySyntaxCategory, byReason };
}
