// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  savedSelection: { view: "code-viewer", featureId: "feature:authentication", featureName: "Authentication" },
};

afterEach(() => {
  cleanup();
  delete window.codeContour;
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

  it("loads persisted selectable models from Main when a project opens", async () => {
    const projectModelApi = { load: async () => ({ version: 1 as const, projectId: "ready", features: [{ id: "feature-saved", name: "Saved feature", origin: "USER" as const, confirmation: "CONFIRMED" as const }], processes: [], dataFlows: [] }), configureRepository: async () => ({}), createFeature: async () => ({}), createProcess: async () => ({}), createDataFlow: async () => ({}), addEvidence: async () => ({}), execute: async () => ({ ok: true }) };
    render(<CodeContourApp initialProjects={[readyProject]} projectModelApi={projectModelApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Ready project" }));
    await waitFor(() => expect(screen.getByText("Saved feature")).not.toBeNull());
  });

  it("uses Electron's exposed Main API by default", async () => {
    const bridge = { load: async () => ({ version: 1 as const, projectId: "ready", features: [{ id: "feature-from-main", name: "Main projection", origin: "USER" as const, confirmation: "CONFIRMED" as const }], processes: [], dataFlows: [] }), listProjects: async () => [readyProject], configureRepository: async () => ({}), createFeature: async () => ({}), createProcess: async () => ({}), createDataFlow: async () => ({}), addEvidence: async () => ({}), execute: async () => ({ ok: true }) };
    Object.defineProperty(window, "codeContour", { configurable: true, value: { projectModel: bridge } });
    render(<CodeContourApp initialProjects={[readyProject]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open Ready project" })).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Open Ready project" }));
    await waitFor(() => expect(screen.getByText("Main projection")).not.toBeNull());
  });

  it("restores the Project Hub list from SQLite after renderer startup", async () => {
    const recovered: HubProject = { ...readyProject, id: "sqlite-project", name: "SQLite project" };
    const bridge = { load: async () => ({ version: 1 as const, projectId: recovered.id, features: [{ id: "from-db", name: "SQLite Feature", origin: "USER" as const, confirmation: "CONFIRMED" as const }], processes: [], dataFlows: [] }), listProjects: async () => [recovered], configureRepository: async () => ({}), createFeature: async () => ({}), createProcess: async () => ({}), createDataFlow: async () => ({}), addEvidence: async () => ({}), execute: async () => ({ ok: true }) };
    Object.defineProperty(window, "codeContour", { configurable: true, value: { projectModel: bridge } });
    render(<CodeContourApp initialProjects={[]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open SQLite project" })).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Open SQLite project" }));
    await waitFor(() => expect(screen.getByText("SQLite Feature")).not.toBeNull());
  });

  it("persists a newly created Feature through Main and reloads its projection", async () => {
    let saved = false;
    const api = {
      load: async () => ({ version: 1 as const, projectId: "ready", features: saved ? [{ id: "feature-main", name: "Persisted feature", origin: "USER" as const, confirmation: "CONFIRMED" as const }] : [], processes: [], dataFlows: [] }),
      configureRepository: async () => ({}), createFeature: async () => { saved = true; return { ok: true }; }, createProcess: async () => ({}), createDataFlow: async () => ({}), addEvidence: async () => ({}), execute: async () => ({ ok: true }),
    };
    render(<CodeContourApp initialProjects={[readyProject]} projectModelApi={api} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Ready project" }));
    fireEvent.change(screen.getByLabelText("Feature name"), { target: { value: "Persisted feature" } });
    fireEvent.click(screen.getByRole("button", { name: "Create feature" }));
    await waitFor(() => expect(screen.getByText("Persisted feature")).not.toBeNull());
  });

  it("keeps the last projection visible and reports a failed Main write", async () => {
    const api = { load: async () => ({ version: 1 as const, projectId: "ready", features: [{ id: "feature-old", name: "Saved before failure", origin: "USER" as const, confirmation: "CONFIRMED" as const }], processes: [], dataFlows: [] }), configureRepository: async () => ({}), createFeature: async () => { throw new Error("database unavailable"); }, createProcess: async () => ({}), createDataFlow: async () => ({}), addEvidence: async () => ({}), execute: async () => ({ ok: true }) };
    render(<CodeContourApp initialProjects={[readyProject]} projectModelApi={api} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Ready project" }));
    await waitFor(() => expect(screen.getByText("Saved before failure")).not.toBeNull());
    fireEvent.change(screen.getByLabelText("Feature name"), { target: { value: "Unsaved change" } });
    fireEvent.click(screen.getByRole("button", { name: "Create feature" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("last saved model"));
    expect(screen.getByText("Saved before failure")).not.toBeNull();
    expect(screen.queryByText("Unsaved change")).toBeNull();
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
