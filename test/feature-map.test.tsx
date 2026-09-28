// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureMapCanvas, FeatureMapInspector, type FeatureMapFeature, type FeatureMapRelation } from "../src/renderer/feature-map.js";

afterEach(cleanup);

const features: readonly FeatureMapFeature[] = [
  { id: "feature-auth", name: "Authentication", confirmation: "CONFIRMED", lifecycle: "ACTIVE", freshness: "STALE", processCount: 2, codeRefCount: 4, explanationCount: 1 },
  { id: "feature-profile", name: "Profile", confirmation: "CANDIDATE", lifecycle: "ARCHIVED", freshness: "CURRENT", processCount: 0, codeRefCount: 0, explanationCount: 0 },
];
const relations: readonly FeatureMapRelation[] = [{ id: "auth-profile", fromFeatureId: "feature-auth", toFeatureId: "feature-profile", label: "uses" }];

describe("Feature Map node and edge presentation", () => {
  it("renders nodes, relation edges, and confirmation/lifecycle/freshness as separate axes", () => {
    render(<FeatureMapCanvas features={features} onCreate={() => undefined} onSelect={() => undefined} relations={relations} selectedFeatureId={undefined} />);
    expect(screen.getByRole("article", { name: "Feature: Authentication" }).textContent).toContain("Confirmation: CONFIRMED");
    expect(screen.getByRole("article", { name: "Feature: Authentication" }).textContent).toContain("Lifecycle: ACTIVE");
    expect(screen.getByRole("article", { name: "Feature: Authentication" }).textContent).toContain("Freshness: STALE");
    expect(screen.getByRole("article", { name: "Feature: Profile" }).textContent).toContain("Lifecycle: ARCHIVED");
    expect(screen.getByLabelText("Feature relation: Authentication → Profile")).not.toBeNull();
  });

  it("selects a node and projects its detail into the Inspector", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<FeatureMapCanvas features={features} onCreate={() => undefined} onSelect={onSelect} relations={relations} selectedFeatureId={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    expect(onSelect).toHaveBeenCalledWith(features[0]);
    rerender(<FeatureMapInspector feature={features[0]} onArchive={() => undefined} onEdit={() => undefined} onViewFlow={() => undefined} />);
    expect(screen.getByLabelText("Feature Map inspector").textContent).toContain("Authentication");
    expect(screen.getByLabelText("Feature Map inspector").textContent).toContain("Process count: 2");
  });
});
