import { AnalysisBatchGate, type AnalysisResultBatch, type BatchAcceptance } from "./analysis-batch-gate.js";

/** Analyzer data only. Database paths, SQL, and driver objects are never valid IPC fields. */
export interface ExecutorAnalysisBatch extends AnalysisResultBatch {
  records?: readonly string[];
}

export interface StagingSnapshotWriter {
  saveStaging(batch: ExecutorAnalysisBatch): BatchAcceptance | void;
}

export type ExecutorMessage = { type: "ANALYSIS_BATCH"; batch: ExecutorAnalysisBatch };

function isExecutorMessage(message: unknown): message is ExecutorMessage {
  if (!message || typeof message !== "object") return false;
  const value = message as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "type" && key !== "batch") || value.type !== "ANALYSIS_BATCH" || !value.batch || typeof value.batch !== "object") return false;
  const batch = value.batch as Record<string, unknown>;
  if (Object.keys(batch).some((key) => key !== "analysisRunId" && key !== "stagingSnapshotId" && key !== "sequenceNumber" && key !== "records")) return false;
  return typeof batch.analysisRunId === "string"
    && typeof batch.stagingSnapshotId === "string"
    && typeof batch.sequenceNumber === "number"
    && (batch.records === undefined || (Array.isArray(batch.records) && batch.records.every((record) => typeof record === "string")));
}

/** Main-process boundary: executor messages cannot write a snapshot directly. */
export class AnalysisBatchController {
  constructor(private readonly gate: AnalysisBatchGate, private readonly writer: StagingSnapshotWriter) {}

  receiveFromExecutor(message: unknown): BatchAcceptance | { accepted: false; reason: "EXECUTOR_WRITE_DENIED" } {
    if (!isExecutorMessage(message)) return { accepted: false, reason: "EXECUTOR_WRITE_DENIED" };
    const accepted = this.gate.accept(message.batch);
    if (!accepted.accepted) return accepted;
    return this.writer.saveStaging(message.batch) ?? accepted;
  }
}
