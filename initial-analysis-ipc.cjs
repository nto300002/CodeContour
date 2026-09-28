function registerInitialAnalysisIpcHandlers({ ipcMain, senderIsTrusted, validPath, loadInitialAnalysisRun }) {
  const analysisRuns = new Map();

  ipcMain.handle("initial-analysis:start", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.projectId)) throw new Error("Invalid project.");
    const { InitialAnalysisRunController } = await loadInitialAnalysisRun();
    const runId = `initial:${input.projectId}:${Date.now()}`;
    const controller = new InitialAnalysisRunController(`active:${input.projectId}`);
    controller.start({ analysisRunId: runId, stagingSnapshotId: `staging:${runId}` });
    analysisRuns.set(runId, { controller, projectId: input.projectId });
    return { runId, status: controller.status, phase: "Indexing source files" };
  });

  ipcMain.handle("initial-analysis:cancel", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.runId) || !validPath(input.projectId)) throw new Error("Invalid analysis run.");
    const run = analysisRuns.get(input.runId);
    if (!run || run.projectId !== input.projectId) throw new Error("Analysis run is unavailable for this project.");
    run.controller.cancel();
    return { status: run.controller.status, phase: "Cancelled by user" };
  });

  return { analysisRuns };
}

module.exports = { registerInitialAnalysisIpcHandlers };
