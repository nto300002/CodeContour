// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import type { FeatureMapFeature, FeatureMapRelation } from "../src/renderer/feature-map.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

const features: readonly FeatureMapFeature[] = [{ id: "feature-auth", name: "Authentication", confirmation: "CONFIRMED", lifecycle: "ACTIVE", freshness: "CURRENT", processCount: 1, codeRefCount: 2, explanationCount: 1 }];
const relations: readonly FeatureMapRelation[] = [];

describe("Feature Map selection and view transition", () => {
  it("updates the Inspector and retains the selected Feature when opening its Flow", () => {
    render(<CodeContourApp initialFeatureMapFeatures={features} initialFeatureMapRelations={relations} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    expect(screen.getByLabelText("Feature Map inspector").textContent).toContain("Authentication");

    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));
    expect(screen.getByRole("heading", { name: "Process / Data Flow" })).not.toBeNull();
    expect(screen.getAllByText("Feature: Authentication")).toHaveLength(3);
  });
});
