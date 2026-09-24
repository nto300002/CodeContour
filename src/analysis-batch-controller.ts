import { AnalysisBatchGate, type AnalysisResultBatch } from "./analysis-batch-gate.js";

export interface StagingSnapshotWriter {
  saveStaging(batch: AnalysisResultBatch): void;
}

export type ExecutorMessage =
  | { type: "ANALYSIS_BATCH"; batch: AnalysisResultBatch }
  | { type: "ACTIVE_SNAPSHOT_WRITE"; batch: AnalysisResultBatch };

/** Main-process boundary: executor messages cannot write a snapshot directly. */
export class AnalysisBatchController {
  constructor(private readonly gate: AnalysisBatchGate, private readonly writer: StagingSnapshotWriter) {}

  receiveFromExecutor(message: ExecutorMessage) {
    if (message.type !== "ANALYSIS_BATCH") return { accepted: false as const, reason: "EXECUTOR_WRITE_DENIED" as const };
    const accepted = this.gate.accept(message.batch);
    if (accepted.accepted) this.writer.saveStaging(message.batch);
    return accepted;
  }
}
