import type { AnalysisStatus } from "./status-states.js";

export type InitialAnalysisState = AnalysisStatus;

export interface InitialAnalysisRun {
  status: InitialAnalysisState;
  phase: string;
  files?: number;
  symbols?: number;
  progress?: { completed: number; total: number };
}

export interface InitialAnalysisProps {
  run: InitialAnalysisRun;
  /** A cancel command is valid only after Main has assigned the Run ID. */
  canCancel: boolean;
  onCancel: () => void;
  onBackground: () => void;
  onRetry: () => void;
  onOpenWorkspace: () => void;
}

export interface InitialAnalysisApi {
  start(input: { projectId: string }): Promise<{ runId: string; status: "ANALYZING"; phase: string }>;
  cancel(input: { runId: string }): Promise<{ status: "CANCELLED"; phase: string }>;
}

const unavailableApi: InitialAnalysisApi = {
  start: async () => { throw new Error("Initial Analysis is unavailable outside the desktop application."); },
  cancel: async () => { throw new Error("Initial Analysis is unavailable outside the desktop application."); },
};

export function desktopInitialAnalysisApi(): InitialAnalysisApi {
  return window.codeContour?.initialAnalysis ?? unavailableApi;
}

const availableWorkspace = (status: InitialAnalysisState) => status === "READY" || status === "PARTIAL";
const running = (status: InitialAnalysisState) => status === "PENDING" || status === "ANALYZING";

/** Renderer projection of an analyzer-owned run; it never accepts executor batches. */
export function InitialAnalysis({ run, canCancel, onCancel, onBackground, onRetry, onOpenWorkspace }: InitialAnalysisProps) {
  const progress = run.progress ? `Progress: ${run.progress.completed} / ${run.progress.total}` : "Progress: Unknown";
  return (
    <section>
      <h1>Initial Analysis</h1>
      <p>State: {run.status}</p>
      <p>Phase: {run.phase}</p>
      <p>{progress}</p>
      <p>Files: {run.files ?? "Unknown"}</p>
      <p>Symbols: {run.symbols ?? "Unknown"}</p>
      {run.status === "PARTIAL" && <p>Some analysis results are unavailable. Open only the available Workspace views.</p>}
      {running(run.status) && <>
        {!canCancel && <p role="status">Starting analysis…</p>}
        <button disabled={!canCancel} onClick={onCancel} type="button">Cancel analysis</button>
        <button onClick={onBackground} type="button">Continue in background</button>
      </>}
      {(run.status === "FAILED" || run.status === "CANCELLED") && <button onClick={onRetry} type="button">Retry analysis</button>}
      {availableWorkspace(run.status) && <button onClick={onOpenWorkspace} type="button">Open available Workspace</button>}
    </section>
  );
}
