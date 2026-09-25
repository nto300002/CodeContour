// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import type { HubProject } from "../src/renderer/project-hub.js";

const readyProject: HubProject = {
  id: "ready",
  name: "Ready project",
  language: "TypeScript",
  updatedAt: "2026-09-25",
  analysisStatus: "READY",
  connectionStatus: "CONNECTED",
  hasActiveSnapshot: true,
  savedSelection: { view: "code-viewer", featureName: "Authentication" },
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Project Hub E2E", () => {
  it("continues from a saved Workspace selection", () => {
    render(<CodeContourApp initialProjects={[readyProject]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue Ready project" }));

    expect(window.location.hash).toBe("#/workspace");
    expect(screen.getByRole("heading", { name: "Code Viewer" })).not.toBeNull();
    expect(screen.getByText("Selected: Authentication")).not.toBeNull();
  });

  it("sends an unanalysed project to Initial Analysis", () => {
    const unanalysed: HubProject = { ...readyProject, id: "new", name: "New project", analysisStatus: "PENDING", hasActiveSnapshot: false };
    render(<CodeContourApp initialProjects={[unanalysed]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open New project" }));

    expect(window.location.hash).toBe("#/analysis");
    expect(screen.getByRole("heading", { name: "initial-analysis" })).not.toBeNull();
  });

  it("sends a disconnected project to Repository Reconnect", () => {
    const disconnected: HubProject = { ...readyProject, id: "missing", name: "Missing project", connectionStatus: "DISCONNECTED" };
    render(<CodeContourApp initialProjects={[disconnected]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Missing project" }));

    expect(window.location.hash).toBe("#/repository/reconnect");
    expect(screen.getByRole("heading", { name: "Repository Reconnect" })).not.toBeNull();
  });

  it("starts registration from an empty Project Hub", () => {
    render(<CodeContourApp initialProjects={[]} />);
    expect(screen.getByRole("status", { name: "No projects" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));

    expect(window.location.hash).toBe("#/repository/setup");
    expect(screen.getByRole("heading", { name: "repository-setup" })).not.toBeNull();
  });

  it("does not add a project when Repository Setup is abandoned", () => {
    render(<CodeContourApp initialProjects={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));
    expect(window.location.hash).toBe("#/repository/setup");

    fireEvent.click(screen.getByRole("button", { name: "Project Hub" }));

    expect(screen.getByRole("status", { name: "No projects" })).not.toBeNull();
    expect(screen.queryByRole("article", { name: "New project" })).toBeNull();
  });
});
