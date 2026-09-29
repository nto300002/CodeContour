function registerInitialAnalysisIpcHandlers({ ipcMain, senderIsTrusted, validPath, loadInitialAnalysisRun, getRepositoryConfiguration, analyze, beginRun, saveBatch, finishRun, failRun, cancelRun, setSymbols }) {
  const analysisRuns = new Map();
  const terminal = (status) => status === "READY" || status === "PARTIAL" || status === "FAILED" || status === "CANCELLED";
  const phaseFor = (status) => status === "READY" || status === "PARTIAL" ? "Analysis complete" : status === "FAILED" ? "Analysis failed" : status === "CANCELLED" ? "Cancelled by user" : "Indexing source files";
  const publish = (run, payload) => { try { run.sender?.send("initial-analysis:state", { projectId: run.projectId, runId: run.runId, ...payload }); } catch {} };
  const projection = (run) => ({ status: run.controller.status, phase: run.phase ?? phaseFor(run.controller.status), files: run.files, symbols: run.symbols });

  ipcMain.handle("initial-analysis:start", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.projectId)) throw new Error("Invalid project.");
    const existing = [...analysisRuns.values()].reverse().find((candidate) => candidate.projectId === input.projectId && !terminal(candidate.controller.status));
    if (existing) return { runId: existing.runId, ...projection(existing) };
    const { InitialAnalysisRunController } = await loadInitialAnalysisRun();
    const runId = `initial:${input.projectId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const stagingSnapshotId = `staging:${runId}`;
    const controller = new InitialAnalysisRunController(`active:${input.projectId}`);
    controller.start({ analysisRunId: runId, stagingSnapshotId });
    const run = { controller, projectId: input.projectId, runId, sender: event.sender, cancelled: false, started: false, finishing: false, phase: "Preparing analysis" };
    analysisRuns.set(runId, run);

    try {
      const configuredRepository = await getRepositoryConfiguration?.(input.projectId);
      if (run.cancelled) return { runId, ...projection(run) };
      const repositoryRoot = input.repositoryRoot ?? configuredRepository?.repositoryRoot;
      const tsconfigPath = input.tsconfigPath ?? configuredRepository?.tsconfigPath;
      // A missing configuration provider is retained for isolated controller tests and non-desktop previews.
      if (getRepositoryConfiguration || input.repositoryRoot || input.tsconfigPath) {
        if (!repositoryRoot || !tsconfigPath || !analyze || !beginRun) throw new Error("Repository configuration is unavailable.");
        run.beginPromise = Promise.resolve().then(() => beginRun(input.projectId, runId, stagingSnapshotId)).then(() => { run.started = true; });
        await run.beginPromise;
      } else return { runId, ...projection(run) };
      if (await cancellationWasAccepted(run)) {
        return { runId, ...projection(run) };
      }
      run.phase = "Indexing source files";
      run.completion = (async () => {
        try {
          const result = await analyze({ repositoryRoot, tsconfigPath });
          if (!result.ok) throw new Error(result.error.message);
          if (await cancellationWasAccepted(run)) return;
          const records = result.symbols.map((symbol) => JSON.stringify(symbol));
          const accepted = await saveBatch({ analysisRunId: runId, stagingSnapshotId, sequenceNumber: 0, records });
          if (accepted?.accepted === false) throw new Error(`Analysis batch rejected: ${accepted.reason}`);
          if (await cancellationWasAccepted(run)) return;
          // Mark the commit boundary synchronously before yielding: cancellation now waits for promotion.
          run.finishing = true;
          await finishRun(input.projectId, runId);
          controller.status = result.filesWithParseErrors.length || result.semanticDiagnostics.length ? "PARTIAL" : "READY";
          run.phase = phaseFor(controller.status);
          run.files = new Set([...result.symbols.map((symbol) => symbol.relativePath), ...result.filesWithParseErrors]).size;
          run.symbols = result.symbols.length;
          publish(run, projection(run));
        } catch (error) {
          if (await cancellationWasAccepted(run) || controller.status === "CANCELLED") return;
          try { await failRun?.(input.projectId, runId); } catch {}
          controller.status = "FAILED";
          run.phase = error instanceof Error ? error.message : "Analysis failed";
          publish(run, projection(run));
        }
      })();
      void run.completion;
    } catch (error) {
      if (run.cancelAttempt) await run.cancelAttempt;
      if (!run.cancelled) {
        if (run.started) { try { await failRun?.(input.projectId, runId); } catch {} }
        controller.status = "FAILED";
        run.phase = error instanceof Error ? error.message : "Unable to start analysis";
        publish(run, projection(run));
      }
    }
    return { runId, ...projection(run) };
  });

  ipcMain.handle("initial-analysis:cancel", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.runId) || !validPath(input.projectId)) throw new Error("Invalid analysis run.");
    const run = analysisRuns.get(input.runId);
    if (!run || run.projectId !== input.projectId) throw new Error("Analysis run is unavailable for this project.");
    if (run.finishing) {
      await run.completion;
      return projection(run);
    }
    if (terminal(run.controller.status)) return projection(run);
    if (run.cancelAttempt) {
      if (!await run.cancelAttempt) run.cancelAttempt = undefined;
      else
      return projection(run);
    }
    let resolveDecision;
    run.cancelAttempt = new Promise((resolve) => { resolveDecision = resolve; });
    run.cancelled = true;
    try {
      // If begin is in flight, don't report cancellation until SQLite confirms it.
      if (run.beginPromise) await run.beginPromise;
      if (run.started) await cancelRun?.(input.projectId, input.runId);
      run.controller.cancel();
      controllerStatus(run, "CANCELLED", "Cancelled by user");
      resolveDecision(true);
      publish(run, projection(run));
    } catch (error) {
      run.cancelled = false;
      run.cancelError = error;
      resolveDecision(false);
      run.cancelAttempt = undefined;
      throw error;
    }
    return projection(run);
  });

  ipcMain.handle("initial-analysis:status", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.runId) || !validPath(input.projectId)) throw new Error("Invalid analysis run.");
    const run = analysisRuns.get(input.runId);
    if (!run || run.projectId !== input.projectId) throw new Error("Analysis run is unavailable for this project.");
    return projection(run);
  });

  ipcMain.handle("initial-analysis:current", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.projectId)) throw new Error("Invalid project.");
    const run = [...analysisRuns.values()].reverse().find((candidate) => candidate.projectId === input.projectId && !terminal(candidate.controller.status));
    return run ? { runId: run.runId, ...projection(run) } : undefined;
  });
  return { analysisRuns };
}

async function cancellationWasAccepted(run) {
  return run.cancelAttempt ? await run.cancelAttempt : run.cancelled;
}

function controllerStatus(run, status, phase) { run.controller.status = status; run.phase = phase; }

module.exports = { registerInitialAnalysisIpcHandlers };
