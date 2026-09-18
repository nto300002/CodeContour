import { describe, expect, it } from "vitest";
import { classifyResolution, evaluateResolutionMetrics, summarizeResolutions } from "../src/relation-resolution.js";

describe("relation resolution state", () => {
  it("only marks compiler-confirmed relations as resolved", () => {
    expect(classifyResolution({ confirmed: true })).toEqual({ resolution: "RESOLVED" });
  });

  it("requires an allowed inference and evidence before marking inferred", () => {
    expect(classifyResolution({ inference: { reason: "DECLARATION_OVERLOAD", evidence: "overload signature" } })).toEqual({
      resolution: "INFERRED", reason: "DECLARATION_OVERLOAD", inferenceEvidence: "overload signature",
    });
    expect(classifyResolution({})).toEqual({ resolution: "UNKNOWN", reason: "UNRESOLVED_SYMBOL" });
  });

  it("does not allow unresolved or dynamic reasons to become inferred", () => {
    for (const reason of ["MISSING_EXPORT", "DYNAMIC_PROPERTY_ACCESS", "UNSUPPORTED_SYNTAX"] as const) {
      expect(classifyResolution({ inference: { reason, evidence: "guess" } })).toEqual({ resolution: "UNKNOWN", reason });
    }
  });

  it("does not allow an allowed inference reason without non-blank evidence", () => {
    for (const evidence of ["", "   ", "\n\t"] as const) {
      expect(classifyResolution({ inference: { reason: "DECLARED_INTERFACE_MEMBER", evidence } })).toEqual({
        resolution: "UNKNOWN", reason: "MISSING_INFERENCE_EVIDENCE",
      });
    }
  });

  it("keeps dynamic and unsupported relations unknown with reviewable causes", () => {
    expect(classifyResolution({ unknownReason: "DYNAMIC_PROPERTY_ACCESS" })).toEqual({ resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS" });
    expect(classifyResolution({ unknownReason: "UNSUPPORTED_SYNTAX" })).toEqual({ resolution: "UNKNOWN", reason: "UNSUPPORTED_SYNTAX" });
  });

  it("summarizes resolution metrics by state and cause", () => {
    expect(summarizeResolutions([
      { resolution: "RESOLVED" },
      { resolution: "INFERRED", reason: "DECLARATION_OVERLOAD" },
      { resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS" },
      { resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS" },
    ])).toEqual({
      total: 4,
      byResolution: { RESOLVED: 1, INFERRED: 1, UNKNOWN: 2 },
      byReason: { DECLARATION_OVERLOAD: 1, DYNAMIC_PROPERTY_ACCESS: 2 },
    });
  });

  it("compares fixture expectations with analyzer output as TP, FP, FN and UNKNOWN", () => {
    const expected = [
      { type: "CALLS", from: "caller", to: "direct", resolution: "RESOLVED", syntaxCategory: "DIRECT_CALL" },
      { type: "CALLS", from: "caller", to: "Runner.run", resolution: "INFERRED", reason: "DECLARED_INTERFACE_MEMBER", syntaxCategory: "INTERFACE_MEMBER_CALL" },
      { type: "CALLS", from: "caller", resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS", syntaxCategory: "COMPUTED_PROPERTY_CALL" },
      { type: "CALLS", from: "caller", to: "missing", resolution: "RESOLVED", syntaxCategory: "DIRECT_CALL" },
    ] as const;
    const actual = [
      { type: "CALLS", from: "caller", to: "direct", resolution: "RESOLVED", syntaxCategory: "DIRECT_CALL" },
      { type: "CALLS", from: "caller", to: "Runner.run", resolution: "INFERRED", reason: "DECLARED_INTERFACE_MEMBER", syntaxCategory: "INTERFACE_MEMBER_CALL" },
      { type: "CALLS", from: "caller", resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS", syntaxCategory: "COMPUTED_PROPERTY_CALL" },
      { type: "CALLS", from: "caller", to: "extra", resolution: "RESOLVED", syntaxCategory: "DIRECT_CALL" },
    ] as const;
    expect(evaluateResolutionMetrics(expected, actual)).toEqual({
      tp: 2, fp: 1, fn: 1, unknown: 1,
      bySyntaxCategory: { DIRECT_CALL: 3, INTERFACE_MEMBER_CALL: 1, COMPUTED_PROPERTY_CALL: 1 },
      byReason: { DECLARED_INTERFACE_MEMBER: 1, DYNAMIC_PROPERTY_ACCESS: 1 },
    });
  });
});
