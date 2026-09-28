// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("Process / Data Flow editing", () => {
  it("normalizes Process order after deletion, creation, and reordering", () => {
    render(<CodeContourApp initialProcessDataFlowByProject={{ "sample-project": { processes: [
      { id: "first", featureId: "feature:authentication", name: "First", order: 0, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
      { id: "middle", featureId: "feature:authentication", name: "Middle", order: 1, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
      { id: "last", featureId: "feature:authentication", name: "Last", order: 2, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
    ], flows: [] } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Middle process" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete process" }));
    fireEvent.change(screen.getByLabelText("New process name"), { target: { value: "Replacement" } });
    fireEvent.click(screen.getByRole("button", { name: "Add process" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Replacement up" }));

    expect(screen.getAllByRole("article", { name: /Process:/ }).map((element) => element.getAttribute("data-process-order"))).toEqual(["0", "1", "2"]);
  });

  it("edits and reorders a Process without leaving the selected Feature", () => {
    render(<CodeContourApp initialProcessDataFlowByProject={{ "sample-project": { processes: [
      { id: "login", featureId: "feature:authentication", name: "Login", order: 1, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
      { id: "validate", featureId: "feature:authentication", name: "Validate", order: 0, lifecycle: "ACTIVE", codeRefCount: 0, inputs: [], outputs: [] },
    ], flows: [{ id: "login-session", featureId: "feature:authentication", fromProcessId: "login", toProcessId: "validate", label: "login session", verification: "UNVERIFIED", freshness: "CURRENT", evidence: [] }] } }} />);
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

    fireEvent.click(screen.getByRole("button", { name: "Select login session data flow" }));
    fireEvent.change(screen.getByLabelText("Edit data flow label"), { target: { value: "authenticated session" } });
    fireEvent.click(screen.getByRole("button", { name: "Save data flow label" }));
    expect(screen.getByRole("article", { name: "Data flow: authenticated session" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete data flow" }));
    expect(screen.queryByRole("article", { name: "Data flow: authenticated session" })).toBeNull();
    expect(screen.getAllByLabelText("Selected Feature").every((element) => element.textContent?.includes("Authentication"))).toBe(true);
  });
});
