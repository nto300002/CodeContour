// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeContourApp } from "../src/renderer/app.js";
import { InitialAnalysisRunController } from "../src/initial-analysis-run.js";
import type { InitialAnalysisApi } from "../src/renderer/initial-analysis.js";
import type { HubProject } from "../src/renderer/project-hub.js";
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
      cancel: vi.fn(async ({ runId: cancelledRunId }: { runId: string; projectId: string }) => { expect(cancelledRunId).toBe(runId); controller.cancel(); return { status: "CANCELLED" as const, phase: "Cancelled by user" }; }),
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
    expect(analysisApi.cancel).toHaveBeenCalledWith({ runId, projectId: "setup:/work/project" });
    expect(controller.receive({ analysisRunId: runId, stagingSnapshotId: "staging-from-ui", sequenceNumber: 1 })).toEqual({ accepted: false, reason: "RUN_CANCELLED" });
  });

  it("does not let a Project B screen cancel Project A's background Run", async () => {
    const projectB: HubProject = {
      id: "project-b", name: "Project B", language: "TypeScript", updatedAt: "2026-09-28",
      analysisStatus: "PENDING", connectionStatus: "CONNECTED", hasActiveSnapshot: false,
    };
    const analysisApi: InitialAnalysisApi = {
      start: vi.fn(async () => ({ runId: "run-a", status: "ANALYZING" as const, phase: "Indexing source files" })),
      cancel: vi.fn(async () => ({ status: "CANCELLED" as const, phase: "Cancelled by user" })),
    };
    render(<CodeContourApp initialAnalysisApi={analysisApi} initialProjects={[projectB]} repositorySetupApi={validApi} />);
    fireEvent.click(screen.getByRole("button", { name: "Register new project" }));
    fireEvent.change(screen.getByLabelText("Repository Root"), { target: { value: "/work/project-a" } });
    fireEvent.change(screen.getByLabelText("tsconfig path"), { target: { value: "tsconfig.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate configuration" }));
    await screen.findByText("Language: TypeScript");
    fireEvent.click(screen.getByRole("button", { name: "Start initial analysis" }));
    expect(await screen.findByText("State: ANALYZING")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue in background" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open Project B" }));

    expect(await screen.findByText("State: PENDING")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Cancel analysis" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(analysisApi.cancel).not.toHaveBeenCalled();
  });
});
