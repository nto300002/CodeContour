// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("Understanding Workspace E2E", () => {
  it("round-trips all three Views in one Workspace route without creating an Inspector route", () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication feature" }));

    for (const view of ["Process / Data Flow", "Code Viewer", "Feature Map"] as const) {
      fireEvent.click(screen.getByRole("button", { name: view }));
      expect(window.location.hash).toBe("#/workspace");
      expect(screen.getByRole("heading", { name: view })).not.toBeNull();
      expect(screen.getByLabelText("Workspace inspector").textContent).toContain("Selection: Authentication feature");
    }
  });
});
