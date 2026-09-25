// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositorySetup, type RepositorySetupApi } from "../src/renderer/repository-setup.js";

const validApi: RepositorySetupApi = {
  pickRoot: vi.fn(),
  pickTsconfig: vi.fn(),
  validate: vi.fn().mockResolvedValue({ ok: true, language: "TypeScript", estimatedFileCount: 12, tsconfigPath: "tsconfig.json" }),
};

afterEach(cleanup);

describe("Repository Setup form validation", () => {
  it("keeps initial analysis disabled until Root and tsconfig validate", async () => {
    render(<RepositorySetup api={validApi} onCancel={() => undefined} onStartAnalysis={() => undefined} />);
    const start = screen.getByRole("button", { name: "Start initial analysis" });
    expect((start as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "tsconfig.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));

    expect(await screen.findByText("Language: TypeScript")).not.toBeNull();
    expect((start as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows Root and tsconfig failures beside their fields", async () => {
    const api: RepositorySetupApi = { ...validApi, validate: vi.fn().mockResolvedValue({ ok: false, fieldErrors: { root: "Root resolves outside the selected directory.", tsconfig: "tsconfig must be inside Repository Root." } }) };
    render(<RepositorySetup api={api} onCancel={() => undefined} onStartAnalysis={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "../outside.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));

    expect(await screen.findByText("Root resolves outside the selected directory.")).not.toBeNull();
    expect(screen.getByText("tsconfig must be inside Repository Root.")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Start initial analysis" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancels without submitting form values", () => {
    const onCancel = vi.fn();
    const onStartAnalysis = vi.fn();
    render(<RepositorySetup api={validApi} onCancel={onCancel} onStartAnalysis={onStartAnalysis} />);
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel setup" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onStartAnalysis).not.toHaveBeenCalled();
  });
});
