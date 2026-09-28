// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceCanvas, WorkspaceInspector, WorkspaceNavigation, type WorkspaceContext } from "../src/renderer/workspace.js";

afterEach(cleanup);

const context: WorkspaceContext = {
  project: { id: "project-1", name: "CodeContour" },
  view: "feature-map",
  selection: { kind: "feature", label: "Authentication feature" },
};

describe("Workspace selection projection", () => {
  it("projects one Selection consistently into Navigation, Canvas, and Inspector", () => {
    render(<>
      <WorkspaceNavigation context={context} />
      <WorkspaceCanvas context={context} onSelect={() => undefined} />
      <WorkspaceInspector context={context} />
    </>);

    expect(screen.getByLabelText("Workspace navigation").textContent).toContain("Selection: Authentication feature");
    expect(screen.getByLabelText("Workspace canvas").textContent).toContain("Selection: Authentication feature");
    expect(screen.getByLabelText("Workspace inspector").textContent).toContain("Selection: Authentication feature");
  });

  it("emits a feature Selection from the Canvas without owning it", () => {
    const onSelect = vi.fn();
    render(<WorkspaceCanvas context={{ ...context, selection: null }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication feature" }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "feature", label: "Authentication feature" });
  });
});
