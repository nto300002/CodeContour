// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("routing E2E", () => {
  it("keeps the Workspace Shell while switching Views and returns after reconnect", () => {
    const { container } = render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Select sample project" }));
    fireEvent.click(screen.getByRole("button", { name: "Understanding Workspace" }));

    const workspaceShell = container.querySelector('[data-layout="workspace-three-pane"]');
    fireEvent.click(screen.getByRole("button", { name: "Code Viewer" }));
    expect(container.querySelector('[data-layout="workspace-three-pane"]')).toBe(workspaceShell);
    expect(screen.getByRole("heading", { name: "Code Viewer" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Simulate repository disconnect" }));
    expect(screen.getByRole("heading", { name: "Repository Reconnect" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect repository" }));
    expect(container.querySelector('[data-layout="workspace-three-pane"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Code Viewer" })).not.toBeNull();
  });

  it("falls back when an unselected project opens a guarded route directly", () => {
    window.location.hash = "#/workspace";
    render(<CodeContourApp />);
    expect(screen.getByRole("heading", { name: "Project Hub" })).not.toBeNull();
    expect(window.location.hash).toBe("#/projects");
  });

  it("discards a recovery returnPath after leaving the recovery screen by hash navigation", () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Select sample project" }));
    fireEvent.click(screen.getByRole("button", { name: "Understanding Workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Simulate repository disconnect" }));

    window.location.hash = "#/projects";
    fireEvent(window, new Event("hashchange"));
    expect(screen.getByRole("heading", { name: "Project Hub" })).not.toBeNull();

    window.location.hash = "#/repository/reconnect";
    fireEvent(window, new Event("hashchange"));
    fireEvent.click(screen.getByRole("button", { name: "Reconnect repository" }));
    expect(screen.getByRole("heading", { name: "Project Hub" })).not.toBeNull();
  });

  it("does not revive an abandoned returnPath through browser back and forward", async () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Select sample project" }));
    fireEvent.click(screen.getByRole("button", { name: "Understanding Workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Simulate repository disconnect" }));
    fireEvent.click(screen.getByRole("button", { name: "Project Hub" }));
    expect(window.location.hash).toBe("#/projects");

    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/repository/reconnect"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Repository Reconnect" })).not.toBeNull());

    window.history.forward();
    await waitFor(() => expect(window.location.hash).toBe("#/projects"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Project Hub" })).not.toBeNull());

    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/repository/reconnect"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Repository Reconnect" })).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Reconnect repository" }));
    expect(screen.getByRole("heading", { name: "Project Hub" })).not.toBeNull();
  });
});
