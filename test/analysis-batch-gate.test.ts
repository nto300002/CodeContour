import { describe, expect, it } from "vitest";
import { AnalysisBatchGate } from "../src/analysis-batch-gate.js";

describe("AnalysisBatchGate", () => {
  it("accepts only monotonically sequenced batches for the current staging Run", () => {
    const gate = new AnalysisBatchGate("active-snapshot");
    gate.begin({ analysisRunId: "run-1", stagingSnapshotId: "staging-1" });

    expect(gate.accept({ analysisRunId: "run-1", stagingSnapshotId: "staging-1", sequenceNumber: 1 })).toEqual({ accepted: true });
    expect(gate.accept({ analysisRunId: "run-1", stagingSnapshotId: "staging-1", sequenceNumber: 1 })).toEqual({ accepted: false, reason: "DUPLICATE_SEQUENCE" });
    expect(gate.accept({ analysisRunId: "run-1", stagingSnapshotId: "active-snapshot", sequenceNumber: 2 })).toEqual({ accepted: false, reason: "ACTIVE_SNAPSHOT_WRITE" });
  });

  it("rejects delayed batches after cancellation or a replacement Run", () => {
    const gate = new AnalysisBatchGate("active-snapshot");
    gate.begin({ analysisRunId: "run-1", stagingSnapshotId: "staging-1" });
    gate.cancel("run-1");
    expect(gate.accept({ analysisRunId: "run-1", stagingSnapshotId: "staging-1", sequenceNumber: 1 })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });

    gate.begin({ analysisRunId: "run-2", stagingSnapshotId: "staging-2" });
    expect(gate.accept({ analysisRunId: "run-1", stagingSnapshotId: "staging-1", sequenceNumber: 2 })).toEqual({ accepted: false, reason: "STALE_RUN" });
    expect(gate.accept({ analysisRunId: "run-2", stagingSnapshotId: "staging-2", sequenceNumber: 1 })).toEqual({ accepted: true });
  });
});
