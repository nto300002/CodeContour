import type { CSSProperties } from "react";

export type AnalysisStatus = "PENDING" | "ANALYZING" | "READY" | "PARTIAL" | "FAILED" | "CANCELLED";
export type StatusBadgeValue = "UNKNOWN" | "STALE" | "ORPHANED" | "CONTRADICTED";
export type ErrorMode = "inline" | "blocking";

type StateCopy = {
  title: string;
  action: string;
};

const stateCopy: Readonly<Record<AnalysisStatus, StateCopy>> = {
  PENDING: { title: "Analysis is pending", action: "Wait for analysis to start." },
  ANALYZING: { title: "Analysis in progress", action: "You can continue using available project information." },
  READY: { title: "Analysis ready", action: "Open the Workspace to explore the project." },
  PARTIAL: { title: "Analysis partially complete", action: "Review the unavailable areas before relying on them." },
  FAILED: { title: "Analysis failed", action: "Retry analysis after resolving the problem." },
  CANCELLED: { title: "Analysis cancelled", action: "Retry analysis when you are ready." },
};

const panelStyle: CSSProperties = { border: "1px solid #9ca3af", borderRadius: "0.375rem", padding: "1rem" };
const listStyle: CSSProperties = { margin: "0.5rem 0", paddingInlineStart: "1.25rem" };

export interface EmptyStateProps {
  title: string;
  description: string;
  action: string;
}

/** A renderer-only empty state with a visible recommended next action. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section aria-label={title} role="status" style={panelStyle}>
      <h2>{title}</h2>
      <p>{description}</p>
      <p>Next: {action}</p>
    </section>
  );
}

export interface AnalysisStatePanelProps {
  status: AnalysisStatus;
  available?: readonly string[];
  unavailable?: readonly string[];
  errorMode?: ErrorMode;
  onRetry?: () => void;
}

/**
 * Presents analyzer state without owning navigation or selection state. This
 * lets retry change only the analysis operation while the caller keeps context.
 */
export function AnalysisStatePanel({
  status,
  available = [],
  unavailable = [],
  errorMode = "inline",
  onRetry,
}: AnalysisStatePanelProps) {
  const copy = stateCopy[status];
  const isError = status === "FAILED" || status === "CANCELLED";

  if (isError) {
    return (
      <section aria-label={copy.title} data-error-mode={errorMode} role="alert" style={panelStyle}>
        {errorMode === "blocking" && <p>Blocking error</p>}
        <h2>{copy.title}</h2>
        <p>{copy.action}</p>
        {onRetry && <button onClick={onRetry} type="button">Retry analysis</button>}
      </section>
    );
  }

  return (
    <section aria-label={copy.title} data-analysis-status={status} role="status" style={panelStyle}>
      <h2>{copy.title}</h2>
      <p>{copy.action}</p>
      {status === "PARTIAL" && (
        <>
          <h3>Available</h3>
          <ul style={listStyle}>{available.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Unavailable</h3>
          <ul style={listStyle}>{unavailable.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      )}
    </section>
  );
}

/** A textual, screen-reader-named badge; color is intentionally not its only signal. */
export function StatusBadge({ status }: { status: StatusBadgeValue }) {
  return <span aria-label={`Status: ${status}`} role="status">{status}</span>;
}
