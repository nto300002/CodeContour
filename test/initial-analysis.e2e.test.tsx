// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import { InitialAnalysisRunController } from "../src/initial-analysis-run.js";
import type { InitialAnalysisApi } from "../src/renderer/initial-analysis.js";
import type { RepositorySetupApi } from "../src/renderer/repository-setup.js";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

const validApi: RepositorySetupApi = { pickRoot: vi.fn(), pickTsconfig: vi.fn(), validate: vi.fn().mockResolvedValue({ ok: true, language: "TypeScript", estimatedFileCount: 3, tsconfigPath: "tsconfig.json" }) };

describe("Initial Analysis E2E", () => {
  it("waits for Main to assign a Run ID, then cancels the Main-owned Run and rejects its delayed batch", async () => {
    const controller = new InitialAnalysisRunController("active-snapshot");
    const runId = "run-from-ui";
    let resolveStart!: (result: { runId: string; status: "ANALYZING"; phase: string }) => void;
    const startResult = new Promise<{ runId: string; status: "ANALYZING"; phase: string }>((resolve) => { resolveStart = resolve; });
    const analysisApi: InitialAnalysisApi = {
      start: vi.fn(() => startResult),
      cancel: vi.fn(async ({ runId: cancelledRunId }: { runId: string }) => { expect(cancelledRunId).toBe(runId); controller.cancel(); return { status: "CANCELLED" as const, phase: "Cancelled by user" }; }),
    };
    render(<CodeContourApp initialAnalysisApi={analysisApi} initialProjects={[]} repositorySetupApi={validApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "tsconfig.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));
    await screen.findByText("Language: TypeScript");
    fireEvent.click(screen.getByRole("button", { name: "Start initial analysis" }));
    expect(await screen.findByText("State: PENDING")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Cancel analysis" }) as HTMLButtonElement).disabled).toBe(true);
    expect(analysisApi.cancel).not.toHaveBeenCalled();
    controller.start({ analysisRunId: runId, stagingSnapshotId: "staging-from-ui" });
    await act(async () => { resolveStart({ runId, status: "ANALYZING", phase: "Indexing source files" }); });
    expect(await screen.findByText("State: ANALYZING")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(await screen.findByText("State: CANCELLED")).not.toBeNull();
    expect(analysisApi.cancel).toHaveBeenCalledWith({ runId });
    expect(controller.receive({ analysisRunId: runId, stagingSnapshotId: "staging-from-ui", sequenceNumber: 1 })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });
  });
});
