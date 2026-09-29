import { describe, expect, it } from "vitest";
import { InitialAnalysisRunController } from "../src/initial-analysis-run.js";

describe("Initial Analysis Run integration", () => {
  it("rejects delayed batches after Cancel and after a replacement Run", () => {
    const controller = new InitialAnalysisRunController("active-snapshot");
    controller.start({ analysisRunId: "run-a", stagingSnapshotId: "staging-a" });
    controller.cancel();
    expect(controller.status).toBe("CANCELLED");
    expect(controller.receive({ analysisRunId: "run-a", stagingSnapshotId: "staging-a", sequenceNumber: 1 })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });

    controller.start({ analysisRunId: "run-b", stagingSnapshotId: "staging-b" });
    expect(controller.receive({ analysisRunId: "run-a", stagingSnapshotId: "staging-a", sequenceNumber: 2 })).toEqual({ accepted: false, reason: "STALE_RUN" });
    expect(controller.receive({ analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 1 })).toEqual({ accepted: true });
  });
});
