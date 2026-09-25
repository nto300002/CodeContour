// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

describe("App Shell visual smoke", () => {
  it("renders the Project Hub and navigates to an independently scrollable Workspace", () => {
    const { container } = render(<CodeContourApp />);

    expect(container.querySelector('[data-layout="project-hub-two-pane"]')).not.toBeNull();
    expect((screen.getByRole("button", { name: "Understanding Workspace" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Select sample project" }));
    fireEvent.click(screen.getByRole("button", { name: "Understanding Workspace" }));

    const workspace = container.querySelector('[data-layout="workspace-three-pane"]');
    expect(workspace).not.toBeNull();
    expect((workspace as HTMLElement).style.display).toBe("grid");
    for (const pane of ["navigation", "canvas", "inspector"]) {
      expect((container.querySelector(`[data-pane="${pane}"]`) as HTMLElement).style.overflow).toBe("auto");
    }

    fireEvent.click(screen.getByRole("button", { name: "Code Viewer" }));
    expect(screen.getByRole("button", { name: "Code Viewer" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "Code Viewer" })).not.toBeNull();
  });
});
