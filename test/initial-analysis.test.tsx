// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InitialAnalysis, type InitialAnalysisState } from "../src/renderer/initial-analysis.js";

afterEach(cleanup);

const states: readonly InitialAnalysisState[] = ["PENDING", "ANALYZING", "READY", "PARTIAL", "FAILED", "CANCELLED"];

describe("Initial Analysis state presentation", () => {
  it.each(states)("displays %s with phase, files, and symbols", (status) => {
    render(<InitialAnalysis onBackground={() => undefined} onCancel={() => undefined} onOpenWorkspace={() => undefined} onRetry={() => undefined} run={{ status, phase: "Symbol indexing", files: 12, symbols: 40 }} />);
    expect(screen.getByText(`State: ${status}`)).not.toBeNull();
    expect(screen.getByText("Phase: Symbol indexing")).not.toBeNull();
    expect(screen.getByText("Files: 12")).not.toBeNull();
    expect(screen.getByText("Symbols: 40")).not.toBeNull();
  });

  it("does not invent a percentage when progress is unknown", () => {
    render(<InitialAnalysis onBackground={() => undefined} onCancel={() => undefined} onOpenWorkspace={() => undefined} onRetry={() => undefined} run={{ status: "ANALYZING", phase: "Resolving imports" }} />);
    expect(screen.getByText("Progress: Unknown")).not.toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it.each(["READY", "PARTIAL"] as const)("opens the Workspace only from %s", (status) => {
    const onOpenWorkspace = vi.fn();
    render(<InitialAnalysis onBackground={() => undefined} onCancel={() => undefined} onOpenWorkspace={onOpenWorkspace} onRetry={() => undefined} run={{ status, phase: "Complete" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open available Workspace" }));
    expect(onOpenWorkspace).toHaveBeenCalledOnce();
  });

  it("offers cancel, background, and retry actions only for their valid states", () => {
    const { rerender } = render(<InitialAnalysis onBackground={() => undefined} onCancel={() => undefined} onOpenWorkspace={() => undefined} onRetry={() => undefined} run={{ status: "ANALYZING", phase: "Indexing" }} />);
    expect(screen.getByRole("button", { name: "Cancel analysis" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Continue in background" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry analysis" })).toBeNull();

    rerender(<InitialAnalysis onBackground={() => undefined} onCancel={() => undefined} onOpenWorkspace={() => undefined} onRetry={() => undefined} run={{ status: "CANCELLED", phase: "Cancelled" }} />);
    expect(screen.getByRole("button", { name: "Retry analysis" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel analysis" })).toBeNull();
  });
});
