const { app, BrowserWindow } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const config = JSON.parse(readFileSync(process.env.CODECONTOUR_APP_SMOKE_CONFIG, "utf8"));
app.setPath("userData", config.userDataPath);
require(join(__dirname, "..", "electron-main.cjs"));

app.whenReady().then(async () => {
  try {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error("The production Electron entry did not create a Window.");
    if (window.webContents.isLoadingMainFrame()) await new Promise((resolve, reject) => {
      window.webContents.once("did-finish-load", resolve);
      window.webContents.once("did-fail-load", (_event, code, description) => reject(new Error(`Renderer load ${code}: ${description}`)));
    });
    const result = await window.webContents.executeJavaScript(`(${runInRenderer.toString()})(${JSON.stringify(config)})`, true);
    writeFileSync(config.reportPath, `${JSON.stringify({ status: "PASS", stage: config.stage, checks: result }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    writeFileSync(config.reportPath, `${JSON.stringify({ status: "FAIL", stage: config.stage, error: message }, null, 2)}\n`);
    process.stderr.write(`${message}\n`);
    app.exit(1);
  }
});

async function runInRenderer(config) {
  const api = window.codeContour;
  if (!api?.repositorySetup || !api?.initialAnalysis || !api?.projectModel) throw new Error("Production Preload API unavailable.");
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const until = async (read, matches, description) => {
    const end = Date.now() + 45000;
    while (Date.now() < end) {
      const value = await read();
      if (matches(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${description}`);
  };
  const project = api.projectModel;
  if (config.stage === "initial") {
    const setup = await api.repositorySetup.validate({ repositoryRoot: config.repositoryRoot, tsconfigPath: "tsconfig.json" });
    assert(setup.ok && setup.estimatedFileCount > 0, `Repository validation failed: ${JSON.stringify(setup)}`);
    await project.configureRepository({ projectId: config.projectId, repositoryRoot: config.repositoryRoot, tsconfigPath: "tsconfig.json" });
    const run = await api.initialAnalysis.start({ projectId: config.projectId });
    const completed = await until(() => api.initialAnalysis.status({ projectId: config.projectId, runId: run.runId }), (state) => state.status === "READY" || state.status === "PARTIAL" || state.status === "FAILED", "initial analysis");
    assert(completed.status === "READY", `Initial analysis did not reach READY: ${JSON.stringify(completed)}`);
    const feature = await project.createFeature({ projectId: config.projectId, name: "Smoke feature" });
    assert(feature.ok, `Feature creation failed: ${JSON.stringify(feature)}`);
    const first = await project.createProcess({ projectId: config.projectId, featureId: feature.feature.id, name: "First", firstStepName: "First" });
    const second = await project.createProcess({ projectId: config.projectId, featureId: feature.feature.id, name: "Second", firstStepName: "Second" });
    assert(first.ok && second.ok, "Process creation failed.");
    const flow = await project.createDataFlow({ projectId: config.projectId, fromProcessId: first.process.id, toProcessId: second.process.id, label: "Answer" });
    assert(flow.ok, `Flow creation failed: ${JSON.stringify(flow)}`);
    const symbols = await project.listSymbols(config.projectId);
    const symbol = symbols.find((item) => item.name === "answer");
    assert(symbol, `Indexed fixture Symbol missing: ${JSON.stringify(symbols)}`);
    const evidence = await project.addEvidence({ projectId: config.projectId, dataFlowId: flow.dataFlow.id, symbolId: symbol.id });
    assert(evidence.ok && evidence.created, `Evidence creation failed: ${JSON.stringify(evidence)}`);
    const saved = await project.load(config.projectId);
    assert(saved.dataFlows.some((item) => item.id === flow.dataFlow.id && item.evidence.some((link) => link.symbolId === symbol.id)), "Saved Evidence missing.");
    return { validatedFiles: setup.estimatedFileCount, runStatus: completed.status, feature: feature.feature.id, flow: flow.dataFlow.id, evidence: symbol.id };
  }
  if (config.stage === "restart-and-failure") {
    const projects = await project.listProjects();
    assert(projects.some((item) => item.id === config.projectId && item.hasActiveSnapshot), "Project or Active Snapshot did not survive restart.");
    const saved = await project.load(config.projectId);
    assert(saved.features.some((item) => item.name === "Smoke feature"), "Feature did not survive restart.");
    assert(saved.processes.length === 2 && saved.dataFlows.length === 1 && saved.dataFlows[0].evidence.length === 1, "Process, Flow or Evidence did not survive restart.");
    await until(() => Promise.resolve([...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Open repository"))), Boolean, "saved Project in Hub");
    [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Open repository")).click();
    await until(() => Promise.resolve(document.body.textContent), (text) => text?.includes("Smoke feature"), "saved Feature in Renderer");
    const run = await api.initialAnalysis.start({ projectId: config.projectId, repositoryRoot: config.repositoryRoot, tsconfigPath: "missing-tsconfig.json" });
    const failed = await until(() => api.initialAnalysis.status({ projectId: config.projectId, runId: run.runId }), (state) => state.status === "FAILED", "failed reanalysis");
    assert(failed.status === "FAILED", "Reanalysis failure was not reported.");
    const after = await project.listProjects();
    assert(after.some((item) => item.id === config.projectId && item.hasActiveSnapshot), "Failed reanalysis removed the Active Snapshot.");
    const unchanged = await project.load(config.projectId);
    assert(unchanged.dataFlows.length === 1 && unchanged.dataFlows[0].evidence.length === 1, "Failed reanalysis changed User Context.");
    return { restored: true, rendererProjection: true, failedReanalysis: failed.status, activeSnapshotPreserved: true };
  }
  throw new Error(`Unknown stage: ${config.stage}`);
}
