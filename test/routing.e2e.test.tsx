// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => window.history.replaceState({}, "", "/"));

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
});
