// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

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
});
