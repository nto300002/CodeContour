import { describe, expect, it } from "vitest";
import { AnalysisBatchGate } from "../src/analysis-batch-gate.js";
import { AnalysisBatchService } from "../src/analysis-batch-service.js";

describe("AnalysisBatchService", () => {
  it("does not save a delayed Batch received after the Run was cancelled", () => {
    const gate = new AnalysisBatchGate("active");
    gate.begin({ analysisRunId: "run", stagingSnapshotId: "staging" });
    gate.cancel("run");
    const service = new AnalysisBatchService(gate);
    expect(service.receive({ analysisRunId: "run", stagingSnapshotId: "staging", sequenceNumber: 1 })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });
    expect(service.saved).toEqual([]);
  });
});
