export interface AnalysisBatchIdentity {
  analysisRunId: string;
  stagingSnapshotId: string;
}

export interface AnalysisResultBatch extends AnalysisBatchIdentity {
  sequenceNumber: number;
}

export type BatchAcceptance = { accepted: true } | { accepted: false; reason: "STALE_RUN" | "RUN_CANCELLED" | "ACTIVE_SNAPSHOT_WRITE" | "DUPLICATE_SEQUENCE" };

export class AnalysisBatchGate {
  private current?: AnalysisBatchIdentity;
  private cancelled = new Set<string>();
  private processed = new Set<string>();

  constructor(private readonly activeSnapshotId: string) {}

  begin(run: AnalysisBatchIdentity): void {
    this.current = run;
  }

  cancel(analysisRunId: string): void {
    this.cancelled.add(analysisRunId);
  }

  accept(batch: AnalysisResultBatch): BatchAcceptance {
    if (batch.stagingSnapshotId === this.activeSnapshotId) return { accepted: false, reason: "ACTIVE_SNAPSHOT_WRITE" };
    if (!this.current || this.current.analysisRunId !== batch.analysisRunId || this.current.stagingSnapshotId !== batch.stagingSnapshotId) return { accepted: false, reason: "STALE_RUN" };
    if (this.cancelled.has(batch.analysisRunId)) return { accepted: false, reason: "RUN_CANCELLED" };
    const key = `${batch.analysisRunId}:${batch.sequenceNumber}`;
    if (this.processed.has(key)) return { accepted: false, reason: "DUPLICATE_SEQUENCE" };
    this.processed.add(key);
    return { accepted: true };
  }
}
