// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("Process / Data Flow editing", () => {
  it("edits and reorders a Process without leaving the selected Feature", () => {
    render(<CodeContourApp initialProcessDataFlowByProject={{ "sample-project": { processes: [
      { id: "login", featureId: "feature:authentication", name: "Login", order: 1, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
      { id: "validate", featureId: "feature:authentication", name: "Validate", order: 0, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
    ], flows: [] } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Login process" }));
    fireEvent.change(screen.getByLabelText("Edit process name"), { target: { value: "Sign in" } });
    fireEvent.click(screen.getByRole("button", { name: "Save process name" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Sign in up" }));

    expect(screen.getAllByLabelText("Selected Feature").every((element) => element.textContent?.includes("Authentication"))).toBe(true);
    expect(screen.getAllByRole("article", { name: /Process:/ })[0].getAttribute("data-process-order")).toBe("0");
    expect(screen.getAllByRole("article", { name: /Process:/ })[0].textContent).toContain("Sign in");
  });
});
