// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceCanvas, WorkspaceInspector, WorkspaceNavigation, type WorkspaceContext } from "../src/renderer/workspace.js";

afterEach(cleanup);

const context: WorkspaceContext = {
  project: { id: "project-1", name: "CodeContour" },
  view: "feature-map",
  selection: {
    feature: { id: "feature:authentication", label: "Authentication feature" },
    process: { id: "process:login", label: "Login process" },
    symbol: { id: "symbol:validate-token", label: "validateToken" },
  },
};

describe("Workspace selection projection", () => {
  it("projects one Selection consistently into Navigation, Canvas, and Inspector", () => {
    render(<>
      <WorkspaceNavigation context={context} />
      <WorkspaceCanvas context={context} onSelect={() => undefined} />
      <WorkspaceInspector context={context} />
    </>);

    for (const pane of ["Workspace navigation", "Workspace canvas", "Workspace inspector"]) {
      expect(screen.getByLabelText(pane).textContent).toContain("Feature: Authentication feature");
      expect(screen.getByLabelText(pane).textContent).toContain("Process: Login process");
      expect(screen.getByLabelText(pane).textContent).toContain("Symbol: validateToken");
    }
  });

  it("emits a feature Selection from the Canvas without owning it", () => {
    const onSelect = vi.fn();
    render(<WorkspaceCanvas context={{ ...context, selection: null }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication feature" }));
    expect(onSelect).toHaveBeenCalledWith({ feature: { id: "feature:authentication", label: "Authentication feature" } });
  });
});
