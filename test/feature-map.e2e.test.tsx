// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import type { HubProject } from "../src/renderer/project-hub.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("Feature Map E2E", () => {
  it("creates the first Feature and opens its Flow", () => {
    render(<CodeContourApp initialFeatureMapFeatures={[]} initialFeatureMapRelations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    expect(screen.getByRole("status", { name: "No features" })).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Feature name"), { target: { value: "Authentication" } });
    fireEvent.click(screen.getByRole("button", { name: "Create feature" }));
    expect(screen.getByLabelText("Feature Map inspector").textContent).toContain("Authentication");
    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));
    expect(window.location.hash).toBe("#/workspace");
    expect(screen.getByRole("heading", { name: "Process / Data Flow" })).not.toBeNull();
  });

  it("keeps created Features within their Project", () => {
    const projectA: HubProject = { id: "project-a", name: "Project A", language: "TypeScript", updatedAt: "2026-09-25", analysisStatus: "READY", connectionStatus: "CONNECTED", hasActiveSnapshot: true };
    const projectB: HubProject = { ...projectA, id: "project-b", name: "Project B" };
    render(<CodeContourApp initialFeatureMapFeaturesByProject={{ "project-a": [], "project-b": [] }} initialProjects={[projectA, projectB]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Project A" }));
    fireEvent.change(screen.getByLabelText("Feature name"), { target: { value: "A only" } });
    fireEvent.click(screen.getByRole("button", { name: "Create feature" }));
    expect(screen.getByRole("article", { name: "Feature: A only" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Project Hub" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Project B" }));
    expect(screen.getByRole("status", { name: "No features" })).not.toBeNull();
    expect(screen.queryByRole("article", { name: "Feature: A only" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Project Hub" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Project A" }));
    expect(screen.getByRole("article", { name: "Feature: A only" })).not.toBeNull();
  });

  it("allocates a new ID when a persisted manual Feature already uses the first ID", () => {
    render(<CodeContourApp initialFeatureMapFeatures={[{ id: "feature:manual-1", name: "Existing", confirmation: "CONFIRMED", lifecycle: "ACTIVE", freshness: "CURRENT", processCount: 0, codeRefCount: 0, explanationCount: 0 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.change(screen.getByLabelText("Feature name"), { target: { value: "Created" } });
    fireEvent.click(screen.getByRole("button", { name: "Create feature" }));
    fireEvent.change(screen.getByLabelText("Edit feature name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save feature name" }));

    expect(screen.getByRole("article", { name: "Feature: Existing" })).not.toBeNull();
    expect(screen.getByRole("article", { name: "Feature: Renamed" })).not.toBeNull();
  });
});
