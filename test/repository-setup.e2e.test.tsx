// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import type { RepositorySetupApi } from "../src/renderer/repository-setup.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

const validApi: RepositorySetupApi = {
  pickRoot: vi.fn(), pickTsconfig: vi.fn(),
  validate: vi.fn().mockResolvedValue({ ok: true, language: "TypeScript", estimatedFileCount: 3, tsconfigPath: "tsconfig.json" }),
};

describe("Repository Setup E2E", () => {
  it("moves a validated registration to Initial Analysis", async () => {
    render(<CodeContourApp initialProjects={[]} repositorySetupApi={validApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "tsconfig.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));
    await screen.findByText("Language: TypeScript");
    fireEvent.click(screen.getByRole("button", { name: "Start initial analysis" }));
    expect(window.location.hash).toBe("#/analysis");
  });

  it("does not move an invalid registration to Initial Analysis", async () => {
    const invalidApi: RepositorySetupApi = { ...validApi, validate: vi.fn().mockResolvedValue({ ok: false, fieldErrors: { tsconfig: "tsconfig cannot be read." } }) };
    render(<CodeContourApp initialProjects={[]} repositorySetupApi={invalidApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "missing.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));
    expect(await screen.findByText("tsconfig cannot be read.")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Start initial analysis" }) as HTMLButtonElement).disabled).toBe(true);
    expect(window.location.hash).toBe("#/repository/setup");
  });
});
