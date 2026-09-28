import { AnalysisBatchGate, type AnalysisBatchIdentity, type AnalysisResultBatch, type BatchAcceptance } from "./analysis-batch-gate.js";
import type { AnalysisStatus } from "./renderer/status-states.js";

/** Main-process run projection and batch gate for Initial Analysis. */
export class InitialAnalysisRunController {
  private readonly gate: AnalysisBatchGate;
  private current?: AnalysisBatchIdentity;
  status: AnalysisStatus = "PENDING";

  constructor(activeSnapshotId: string) {
    this.gate = new AnalysisBatchGate(activeSnapshotId);
  }

  start(run: AnalysisBatchIdentity): void {
    this.current = run;
    this.gate.begin(run);
    this.status = "ANALYZING";
  }

  cancel(): void {
    if (!this.current) return;
    this.gate.cancel(this.current.analysisRunId);
    this.status = "CANCELLED";
  }

  receive(batch: AnalysisResultBatch): BatchAcceptance {
    return this.gate.accept(batch);
  }
}
