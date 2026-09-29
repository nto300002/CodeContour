import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { InitialAnalysisRunController } from "../src/initial-analysis-run.js";

const require = createRequire(import.meta.url);
const { registerInitialAnalysisIpcHandlers } = require("../initial-analysis-ipc.cjs") as {
  registerInitialAnalysisIpcHandlers: (dependencies: {
    ipcMain: { handle: (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => void };
    senderIsTrusted: (event: unknown) => boolean;
    validPath: (value: unknown) => boolean;
    loadInitialAnalysisRun: () => Promise<{ InitialAnalysisRunController: typeof InitialAnalysisRunController }>;
    getRepositoryConfiguration?: (projectId: string) => Promise<{ repositoryRoot: string; tsconfigPath: string } | undefined>;
    beginRun?: (...args: unknown[]) => Promise<void>;
    cancelRun?: (...args: unknown[]) => Promise<void>;
    analyze?: (input: { repositoryRoot: string; tsconfigPath: string }) => Promise<{ ok: boolean; symbols: unknown[]; filesWithParseErrors: string[]; semanticDiagnostics: string[] }>;
    saveBatch?: (...args: unknown[]) => Promise<{ accepted: true } | { accepted: false; reason: string }>;
    finishRun?: (...args: unknown[]) => Promise<void>;
    failRun?: (...args: unknown[]) => Promise<void>;
  }) => { analysisRuns: Map<string, { controller: InitialAnalysisRunController; projectId: string }> };
};

describe("Initial Analysis IPC integration", () => {
  it("rejects a valid Run ID when the cancel request names a different Project", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    const { analysisRuns } = registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
    });
    const start = handlers.get("initial-analysis:start");
    const cancel = handlers.get("initial-analysis:cancel");
    if (!start || !cancel) throw new Error("Initial Analysis IPC handlers were not registered.");

    const created = await start({}, { projectId: "project-a" }) as { runId: string };
    await expect(cancel({}, { runId: created.runId, projectId: "project-b" })).rejects.toThrow("Analysis run is unavailable for this project.");
    expect(analysisRuns.get(created.runId)?.controller.status).toBe("ANALYZING");

    await expect(cancel({}, { runId: created.runId, projectId: "project-a" })).resolves.toEqual({ status: "CANCELLED", phase: "Cancelled by user" });
  });

  it("uses SQLite repository settings for an analysis request and starts its durable staging Run", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    const starts: unknown[][] = [];
    registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
      getRepositoryConfiguration: async () => ({ repositoryRoot: "/project/repo", tsconfigPath: "tsconfig.json" }),
      beginRun: async (...args: unknown[]) => { starts.push(args); },
      analyze: async () => new Promise(() => {}),
    });
    const start = handlers.get("initial-analysis:start");
    if (!start) throw new Error("Initial Analysis start handler missing");
    await start({ sender: { send: () => {} } }, { projectId: "project-a" });
    expect(starts).toHaveLength(1);
    expect(starts[0][0]).toBe("project-a");
    expect(starts[0][2]).toContain("staging:initial:project-a:");
  });

  it("exposes Run state through a request scoped to the same Project", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    const { analysisRuns } = registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
    });
    const created = await handlers.get("initial-analysis:start")!({}, { projectId: "project-a" }) as { runId: string };
    expect(await handlers.get("initial-analysis:status")!({}, { runId: created.runId, projectId: "project-a" })).toMatchObject({ status: "ANALYZING" });
    analysisRuns.get(created.runId)!.controller.status = "FAILED";
    expect(await handlers.get("initial-analysis:status")!({}, { runId: created.runId, projectId: "project-a" })).toMatchObject({ status: "FAILED" });
    await expect(handlers.get("initial-analysis:status")!({}, { runId: created.runId, projectId: "project-b" })).rejects.toThrow("unavailable for this project");
  });

  it("keeps a cancellation after batch persistence from promoting or reporting FAILED", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    let resolveSave!: (value: { accepted: true }) => void;
    let saveStarted!: () => void;
    const saving = new Promise<{ accepted: true }>((resolve) => { resolveSave = resolve; });
    const reachedSave = new Promise<void>((resolve) => { saveStarted = resolve; });
    let promoted = false;
    const dependencies = {
      ipcMain: { handle: (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => handlers.set(channel, handler) },
      senderIsTrusted: () => true,
      validPath: (value: unknown) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
      getRepositoryConfiguration: async () => ({ repositoryRoot: "/repo", tsconfigPath: "tsconfig.json" }),
      beginRun: async () => {},
      analyze: async () => ({ ok: true, symbols: [{ id: "symbol" }], filesWithParseErrors: [], semanticDiagnostics: [], files: ["a.ts"] }),
      saveBatch: async () => { saveStarted(); return saving; },
      finishRun: async () => { promoted = true; },
      cancelRun: async () => {},
    };
    registerInitialAnalysisIpcHandlers(dependencies);
    const sender = { send: () => {} };
    const created = await handlers.get("initial-analysis:start")!({ sender }, { projectId: "project-a" }) as { runId: string };
    await reachedSave;
    const cancelled = await handlers.get("initial-analysis:cancel")!({ sender }, { projectId: "project-a", runId: created.runId });
    expect(cancelled).toMatchObject({ status: "CANCELLED" });
    resolveSave({ accepted: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(promoted).toBe(false);
    expect(await handlers.get("initial-analysis:status")!({ sender }, { projectId: "project-a", runId: created.runId })).toMatchObject({ status: "CANCELLED" });
  });

  it("propagates a database cancellation error and leaves the Run analyzing", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    const { analysisRuns } = registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
      getRepositoryConfiguration: async () => ({ repositoryRoot: "/repo", tsconfigPath: "tsconfig.json" }),
      beginRun: async () => {}, analyze: async () => new Promise(() => {}),
      cancelRun: async () => { throw new Error("database unavailable"); },
    });
    const sender = { send: () => {} };
    const created = await handlers.get("initial-analysis:start")!({ sender }, { projectId: "project-db-error" }) as { runId: string };
    await expect(handlers.get("initial-analysis:cancel")!({ sender }, { projectId: "project-db-error", runId: created.runId })).rejects.toThrow("database unavailable");
    expect(analysisRuns.get(created.runId)?.controller.status).toBe("ANALYZING");
  });

  it("continues promotion when cancellation fails while analysis is finishing", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    let resolveAnalysis!: (value: { ok: true; symbols: { relativePath: string }[]; filesWithParseErrors: string[]; semanticDiagnostics: string[] }) => void;
    let rejectDatabaseCancel!: (error: Error) => void;
    const analysis = new Promise<{ ok: true; symbols: { relativePath: string }[]; filesWithParseErrors: string[]; semanticDiagnostics: string[] }>((resolve) => { resolveAnalysis = resolve; });
    let promoted = false;
    registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
      getRepositoryConfiguration: async () => ({ repositoryRoot: "/repo", tsconfigPath: "tsconfig.json" }),
      beginRun: async () => {}, analyze: async () => analysis,
      saveBatch: async () => ({ accepted: true }), finishRun: async () => { promoted = true; },
      cancelRun: async () => new Promise((_, reject) => { rejectDatabaseCancel = reject; }),
    });
    const sender = { send: () => {} };
    const created = await handlers.get("initial-analysis:start")!({ sender }, { projectId: "project-finishing" }) as { runId: string };
    const cancel = handlers.get("initial-analysis:cancel")!({ sender }, { projectId: "project-finishing", runId: created.runId });
    resolveAnalysis({ ok: true, symbols: [], filesWithParseErrors: [], semanticDiagnostics: [] });
    await Promise.resolve();
    rejectDatabaseCancel(new Error("database unavailable"));
    await expect(cancel).rejects.toThrow("database unavailable");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(promoted).toBe(true);
    expect(await handlers.get("initial-analysis:status")!({ sender }, { projectId: "project-finishing", runId: created.runId })).toMatchObject({ status: "READY" });
  });

  it("retries the database cancellation after an earlier cancellation failure", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    let calls = 0;
    const { analysisRuns } = registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
      getRepositoryConfiguration: async () => ({ repositoryRoot: "/repo", tsconfigPath: "tsconfig.json" }),
      beginRun: async () => {}, analyze: async () => new Promise(() => {}),
      cancelRun: async () => { if (++calls === 1) throw new Error("transient database failure"); },
    });
    const sender = { send: () => {} };
    const created = await handlers.get("initial-analysis:start")!({ sender }, { projectId: "project-cancel-retry" }) as { runId: string };
    const cancel = handlers.get("initial-analysis:cancel")!({ sender }, { projectId: "project-cancel-retry", runId: created.runId });
    await expect(cancel).rejects.toThrow("transient database failure");
    await expect(handlers.get("initial-analysis:cancel")!({ sender }, { projectId: "project-cancel-retry", runId: created.runId })).resolves.toMatchObject({ status: "CANCELLED" });
    expect(calls).toBe(2);
    expect(analysisRuns.get(created.runId)?.controller.status).toBe("CANCELLED");
  });

  it("waits for an in-flight begin before cancelling and exposes cancellation failure", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    let completeBegin!: () => void;
    const beginGate = new Promise<void>((resolve) => { completeBegin = resolve; });
    const { analysisRuns } = registerInitialAnalysisIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true,
      validPath: (value) => typeof value === "string" && value.length > 0,
      loadInitialAnalysisRun: async () => ({ InitialAnalysisRunController }),
      getRepositoryConfiguration: async () => ({ repositoryRoot: "/repo", tsconfigPath: "tsconfig.json" }),
      beginRun: async () => beginGate, analyze: async () => new Promise(() => {}),
      cancelRun: async () => { throw new Error("database cancellation failed"); },
    });
    const sender = { send: () => {} };
    const start = handlers.get("initial-analysis:start")!({ sender }, { projectId: "project-begin-race" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const runId = [...analysisRuns.keys()][0];
    const cancel = handlers.get("initial-analysis:cancel")!({ sender }, { projectId: "project-begin-race", runId });
    completeBegin();
    await expect(cancel).rejects.toThrow("database cancellation failed");
    await expect(start).resolves.toMatchObject({ status: "ANALYZING" });
    expect(analysisRuns.get(runId)?.controller.status).toBe("ANALYZING");
  });
});
