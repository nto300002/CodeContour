// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("recoverable analysis state in the Workspace", () => {
  it("retries without changing the current Workspace route or feature selection", () => {
    const { container } = render(<CodeContourApp initialAnalysisStatus="FAILED" />);
    fireEvent.click(screen.getByRole("button", { name: "Select sample project" }));
    fireEvent.click(screen.getByRole("button", { name: "Understanding Workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication feature" }));

    const workspace = container.querySelector('[data-layout="workspace-three-pane"]');
    expect(screen.getByText("Selected: Authentication feature")).not.toBeNull();
    expect(screen.getByRole("alert", { name: "Analysis failed" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(container.querySelector('[data-layout="workspace-three-pane"]')).toBe(workspace);
    expect(window.location.hash).toBe("#/workspace");
    expect(screen.getByText("Selected: Authentication feature")).not.toBeNull();
    expect(screen.getByRole("status", { name: "Analysis in progress" })).not.toBeNull();
  });
});
