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
    fireEvent.change(screen.getByLabelText("Evidence symbol"), { target: { value: "validateToken" } });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    expect(screen.getAllByLabelText("Selected Feature").every((element) => element.textContent?.includes("Authentication"))).toBe(true);
    expect(screen.getByLabelText("Process / Data Flow inspector").textContent).toContain("Evidence: validateToken");
    expect(screen.getByRole("article", { name: "Data flow: session creation" }).textContent).toContain("Verification: EVIDENCED");
  });
});
