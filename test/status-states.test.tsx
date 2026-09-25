// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AnalysisStatePanel, EmptyState, StatusBadge, type AnalysisStatus } from "../src/renderer/status-states.js";

const stateExpectations: ReadonlyArray<{ status: AnalysisStatus; title: string; action: string }> = [
  { status: "PENDING", title: "Analysis is pending", action: "Wait for analysis to start." },
  { status: "ANALYZING", title: "Analysis in progress", action: "You can continue using available project information." },
  { status: "READY", title: "Analysis ready", action: "Open the Workspace to explore the project." },
  { status: "PARTIAL", title: "Analysis partially complete", action: "Review the unavailable areas before relying on them." },
  { status: "FAILED", title: "Analysis failed", action: "Retry analysis after resolving the problem." },
  { status: "CANCELLED", title: "Analysis cancelled", action: "Retry analysis when you are ready." },
];

afterEach(cleanup);

describe("analysis state presentation", () => {
  it("explains an empty result and the next action", () => {
    render(<EmptyState action="Create a feature" description="No features have been created yet." title="No features" />);

    expect(screen.getByRole("status", { name: "No features" })).not.toBeNull();
    expect(screen.getByText("No features have been created yet.")).not.toBeNull();
    expect(screen.getByText("Next: Create a feature")).not.toBeNull();
  });

  it.each(stateExpectations)("explains $status and its recommended action", ({ status, title, action }) => {
    render(<AnalysisStatePanel status={status} onRetry={() => undefined} />);

    expect(screen.getByText(title)).not.toBeNull();
    expect(screen.getByText(action)).not.toBeNull();
  });

  it("shows both available and unavailable scope for PARTIAL", () => {
    render(<AnalysisStatePanel available={["Symbol index", "Definition navigation"]} status="PARTIAL" unavailable={["Call graph"]} />);

    expect(screen.getByText("Available")).not.toBeNull();
    expect(screen.getByText("Symbol index")).not.toBeNull();
    expect(screen.getByText("Unavailable")).not.toBeNull();
    expect(screen.getByText("Call graph")).not.toBeNull();
  });

  it("distinguishes inline and blocking errors without relying on color", () => {
    const { rerender } = render(<AnalysisStatePanel errorMode="inline" status="FAILED" onRetry={() => undefined} />);
    expect(screen.getByRole("alert").getAttribute("data-error-mode")).toBe("inline");
    expect(screen.getByRole("button", { name: "Retry analysis" })).not.toBeNull();

    rerender(<AnalysisStatePanel errorMode="blocking" status="FAILED" onRetry={() => undefined} />);
    expect(screen.getByRole("alert").getAttribute("data-error-mode")).toBe("blocking");
    expect(screen.getByText("Blocking error")).not.toBeNull();
  });

  it("retries without changing the current screen or selection", () => {
    function RecoveryHarness() {
      const [status, setStatus] = useState<AnalysisStatus>("FAILED");
      return (
        <>
          <p>Screen: Understanding Workspace</p>
          <p>Selection: Authentication feature</p>
          <AnalysisStatePanel status={status} onRetry={() => setStatus("ANALYZING")} />
        </>
      );
    }

    render(<RecoveryHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(screen.getByText("Screen: Understanding Workspace")).not.toBeNull();
    expect(screen.getByText("Selection: Authentication feature")).not.toBeNull();
    expect(screen.getByText("Analysis in progress")).not.toBeNull();
  });

  it("exposes state names through text and accessible names", () => {
    render(
      <>
        <AnalysisStatePanel status="ANALYZING" />
        <StatusBadge status="UNKNOWN" />
        <StatusBadge status="STALE" />
        <StatusBadge status="ORPHANED" />
        <StatusBadge status="CONTRADICTED" />
      </>,
    );

    expect(screen.getByRole("status", { name: "Analysis in progress" })).not.toBeNull();
    for (const status of ["UNKNOWN", "STALE", "ORPHANED", "CONTRADICTED"]) {
      expect(screen.getByRole("status", { name: `Status: ${status}` })).not.toBeNull();
      expect(screen.getByText(status)).not.toBeNull();
    }
  });
});
