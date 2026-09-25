import { AnalysisBatchGate, type AnalysisResultBatch } from "./analysis-batch-gate.js";

export class AnalysisBatchService {
  readonly saved: AnalysisResultBatch[] = [];
  constructor(private readonly gate: AnalysisBatchGate) {}
  receive(batch: AnalysisResultBatch) {
    const accepted = this.gate.accept(batch);
    if (accepted.accepted) this.saved.push(batch);
    return accepted;
  }
}
