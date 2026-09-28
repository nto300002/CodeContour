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
});
