// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import type { RepositorySetupApi } from "../src/renderer/repository-setup.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

const validApi: RepositorySetupApi = { pickRoot: vi.fn(), pickTsconfig: vi.fn(), validate: vi.fn().mockResolvedValue({ ok: true, language: "TypeScript", estimatedFileCount: 3, tsconfigPath: "tsconfig.json" }) };

describe("Initial Analysis E2E", () => {
  it("starts from validated setup, shows pending analysis, and can be cancelled", async () => {
    render(<CodeContourApp initialProjects={[]} repositorySetupApi={validApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "tsconfig.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));
    await screen.findByText("Language: TypeScript");
    fireEvent.click(screen.getByRole("button", { name: "Start initial analysis" }));
    expect(screen.getByText("State: PENDING")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(screen.getByText("State: CANCELLED")).not.toBeNull();
  });
});
