// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("Process / Data Flow E2E", () => {
  it("keeps the current View and Context when no Feature is selected", () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Process / Data Flow" }));

    expect(screen.getByRole("heading", { name: "Feature Map" })).not.toBeNull();
    expect(screen.getByRole("status", { name: "No feature selected" })).not.toBeNull();
  });

  it("creates, reorders, and attaches Evidence while retaining the Feature Context", () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));

    fireEvent.change(screen.getByLabelText("New process name"), { target: { value: "Login" } });
    fireEvent.click(screen.getByRole("button", { name: "Add process" }));
    fireEvent.change(screen.getByLabelText("New process name"), { target: { value: "Create session" } });
    fireEvent.click(screen.getByRole("button", { name: "Add process" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Create session up" }));

    fireEvent.change(screen.getByLabelText("From process"), { target: { value: "process:manual-2" } });
    fireEvent.change(screen.getByLabelText("To process"), { target: { value: "process:manual-1" } });
    fireEvent.change(screen.getByLabelText("Data flow label"), { target: { value: "session creation" } });
    fireEvent.click(screen.getByRole("button", { name: "Add data flow" }));
    fireEvent.click(screen.getByRole("button", { name: "Select session creation data flow" }));
    fireEvent.change(screen.getByLabelText("Evidence symbol"), { target: { value: "symbol:validate-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    expect(screen.getAllByLabelText("Selected Feature").every((element) => element.textContent?.includes("Authentication"))).toBe(true);
    expect(screen.getByLabelText("Process / Data Flow inspector").textContent).toContain("Evidence: validateToken");
    expect(screen.getByRole("article", { name: "Data flow: session creation" }).textContent).toContain("Verification: EVIDENCED");
  });

  it("keeps a Flow unverified when its Evidence does not resolve to a canonical Project Symbol", () => {
    render(<CodeContourApp />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));
    fireEvent.change(screen.getByLabelText("New process name"), { target: { value: "Validate" } });
    fireEvent.click(screen.getByRole("button", { name: "Add process" }));
    fireEvent.change(screen.getByLabelText("From process"), { target: { value: "process:login" } });
    fireEvent.change(screen.getByLabelText("To process"), { target: { value: "process:manual-1" } });
    fireEvent.change(screen.getByLabelText("Data flow label"), { target: { value: "token validation" } });
    fireEvent.click(screen.getByRole("button", { name: "Add data flow" }));
    fireEvent.change(screen.getByLabelText("Evidence symbol"), { target: { value: "inventedSymbol" } });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    const flow = screen.getByRole("article", { name: "Data flow: token validation" });
    expect(flow.textContent).toContain("Verification: UNVERIFIED");
    expect(screen.getByLabelText("Process / Data Flow inspector").textContent).not.toContain("inventedSymbol");
  });

  it("rejects external and unknown Symbols even when a forged select value is submitted", () => {
    render(<CodeContourApp initialProjectSymbolsByProject={{ "sample-project": [
      { id: "project", name: "projectSymbol", qualifiedName: "projectSymbol", kind: "FUNCTION", relativePath: "src/project.ts", range: { start: 1, end: 10 }, targetScope: "PROJECT" },
      { id: "external", name: "externalSymbol", qualifiedName: "externalSymbol", kind: "FUNCTION", relativePath: "node_modules/pkg/index.d.ts", range: { start: 1, end: 10 }, targetScope: "EXTERNAL" },
      { id: "unknown", name: "unknownSymbol", qualifiedName: "unknownSymbol", kind: "FUNCTION", relativePath: "src/unknown.ts", range: { start: 1, end: 10 }, targetScope: "UNKNOWN" },
    ] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CodeContour sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Authentication" }));
    fireEvent.click(screen.getByRole("button", { name: "View Authentication flow" }));
    fireEvent.change(screen.getByLabelText("New process name"), { target: { value: "Validate" } });
    fireEvent.click(screen.getByRole("button", { name: "Add process" }));
    fireEvent.change(screen.getByLabelText("From process"), { target: { value: "process:login" } });
    fireEvent.change(screen.getByLabelText("To process"), { target: { value: "process:manual-1" } });
    fireEvent.change(screen.getByLabelText("Data flow label"), { target: { value: "token validation" } });
    fireEvent.click(screen.getByRole("button", { name: "Add data flow" }));

    expect(screen.queryByRole("option", { name: /externalSymbol/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /unknownSymbol/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Evidence symbol"), { target: { value: "external" } });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));
    fireEvent.change(screen.getByLabelText("Evidence symbol"), { target: { value: "unknown" } });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    expect(screen.getByRole("article", { name: "Data flow: token validation" }).textContent).toContain("Verification: UNVERIFIED");
    expect(screen.getByLabelText("Process / Data Flow inspector").textContent).not.toMatch(/externalSymbol|unknownSymbol/);
    expect(screen.getAllByLabelText("Selected Feature").every((element) => element.textContent?.includes("Authentication"))).toBe(true);
  });
});
