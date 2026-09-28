// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("Workspace view integration", () => {
  it("keeps the Project Context and Selection while switching Views", () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication feature" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Login process" }));
    fireEvent.click(screen.getByRole("button", { name: "Select validateToken symbol" }));

    fireEvent.click(screen.getByRole("button", { name: "Process / Data Flow" }));
    expect(screen.getByRole("heading", { name: "Process / Data Flow" })).not.toBeNull();
    expect(screen.getAllByText("Project: CodeContour sample")).toHaveLength(3);
    expect(screen.getAllByText("Feature: Authentication feature")).toHaveLength(3);
    expect(screen.getAllByText("Process: Login process")).toHaveLength(3);
    expect(screen.getAllByText("Symbol: validateToken")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Code Viewer" }));
    expect(screen.getByRole("heading", { name: "Code Viewer" })).not.toBeNull();
    expect(screen.getAllByText("Symbol: validateToken")).toHaveLength(3);
  });
});
