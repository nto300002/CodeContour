// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectHub, type HubProject } from "../src/renderer/project-hub.js";

const readyProject: HubProject = {
  id: "contour",
  name: "CodeContour",
  language: "TypeScript",
  updatedAt: "2026-09-25",
  analysisStatus: "READY",
  connectionStatus: "CONNECTED",
  hasActiveSnapshot: true,
  savedSelection: { view: "code-viewer", featureName: "Authentication" },
};

afterEach(cleanup);

describe("Project Hub", () => {
  it("renders a project card with its metadata, state, and actions", () => {
    render(<ProjectHub onContinue={() => undefined} onOpen={() => undefined} onRegister={() => undefined} projects={[readyProject]} />);

    expect(screen.getByRole("article", { name: "CodeContour" })).not.toBeNull();
    expect(screen.getByText("Language: TypeScript")).not.toBeNull();
    expect(screen.getByText("Updated: 2026-09-25")).not.toBeNull();
    expect(screen.getByText("Analysis: READY")).not.toBeNull();
    expect(screen.getByText("Connection: CONNECTED")).not.toBeNull();
    expect(screen.getByText("Recent work: Code Viewer — Authentication")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Open CodeContour" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Continue CodeContour" })).not.toBeNull();
  });

  it("delegates open and continue actions for the selected card", () => {
    const onOpen = vi.fn();
    const onContinue = vi.fn();
    render(<ProjectHub onContinue={onContinue} onOpen={onOpen} onRegister={() => undefined} projects={[readyProject]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue CodeContour" }));
    expect(onOpen).toHaveBeenCalledWith(readyProject);
    expect(onContinue).toHaveBeenCalledWith(readyProject);
  });
});
