import { describe, expect, it } from "vitest";
import { AnalysisBatchController } from "../src/analysis-batch-controller.js";
import { AnalysisBatchGate, type AnalysisResultBatch } from "../src/analysis-batch-gate.js";

describe("AnalysisBatchController", () => {
  it("routes a delayed executor Batch through the Main Gate and does not save it after cancellation", () => {
    const saved: AnalysisResultBatch[] = [];
    const gate = new AnalysisBatchGate("active");
    gate.begin({ analysisRunId: "run", stagingSnapshotId: "staging" });
    gate.cancel("run");
    const controller = new AnalysisBatchController(gate, { saveStaging: (batch) => { saved.push(batch); } });

    expect(controller.receiveFromExecutor({ type: "ANALYSIS_BATCH", batch: { analysisRunId: "run", stagingSnapshotId: "staging", sequenceNumber: 1 } }))
      .toEqual({ accepted: false, reason: "RUN_CANCELLED" });
    expect(saved).toEqual([]);
  });

  it("does not expose an Active Snapshot write path to the executor", () => {
    const saved: AnalysisResultBatch[] = [];
    const gate = new AnalysisBatchGate("active");
    gate.begin({ analysisRunId: "run", stagingSnapshotId: "staging" });
    const controller = new AnalysisBatchController(gate, { saveStaging: (batch) => { saved.push(batch); } });

    expect(controller.receiveFromExecutor({ type: "ACTIVE_SNAPSHOT_WRITE", batch: { analysisRunId: "run", stagingSnapshotId: "active", sequenceNumber: 1 } }))
      .toEqual({ accepted: false, reason: "EXECUTOR_WRITE_DENIED" });
    expect(saved).toEqual([]);
  });
});
