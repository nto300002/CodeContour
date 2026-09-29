const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { registerInitialAnalysisIpcHandlers } = require("./initial-analysis-ipc.cjs");
const { registerProjectModelIpcHandlers } = require("./project-model-ipc.cjs");

if (process.env.CODECONTOUR_SQLITE_DRIVER) {
  require("./test/fixtures/sqlite-packaged-main.cjs");
} else {
  const senderIsTrusted = (event) => event.senderFrame && event.senderFrame.url.startsWith("file:");
  const validPath = (value) => typeof value === "string" && value.length > 0;
  const loadRepositoryReader = async () => import(pathToFileURL(join(__dirname, "dist", "main", "src", "repository-reader.js")).href);
  const loadInitialAnalysisRun = async () => import(pathToFileURL(join(__dirname, "dist", "main", "src", "initial-analysis-run.js")).href);
  const loadProjectModelRuntime = async () => import(pathToFileURL(join(__dirname, "dist", "main", "src", "main-project-model-runtime.js")).href);
  const loadSymbolIndex = async () => import(pathToFileURL(join(__dirname, "dist", "main", "src", "symbol-index.js")).href);
  let projectModelRuntime;
  const projectModel = async () => {
    if (!projectModelRuntime) {
      const { MainProjectModelRuntime } = await loadProjectModelRuntime();
      projectModelRuntime = new MainProjectModelRuntime(join(app.getPath("userData"), "codecontour.sqlite"));
    }
    return projectModelRuntime;
  };

  ipcMain.handle("repository-setup:pick-root", async (event) => {
    if (!senderIsTrusted(event)) throw new Error("Untrusted IPC sender.");
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle("repository-setup:pick-tsconfig", async (event, repositoryRoot) => {
    if (!senderIsTrusted(event) || !validPath(repositoryRoot)) throw new Error("Invalid repository root.");
    const result = await dialog.showOpenDialog({ defaultPath: repositoryRoot, filters: [{ name: "tsconfig", extensions: ["json"] }], properties: ["openFile"] });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle("repository-setup:validate", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.repositoryRoot) || !validPath(input.tsconfigPath)) {
      return { ok: false, fieldErrors: { root: "Repository Root and tsconfig path are required." } };
    }
    const { loadTypeScriptProject } = await loadRepositoryReader();
    const result = await loadTypeScriptProject(input);
    if (!result.ok) {
      const field = result.error.code === "REPOSITORY_READ_ERROR" ? "root" : "tsconfig";
      return { ok: false, fieldErrors: { [field]: result.error.message } };
    }
    return { ok: true, language: "TypeScript", estimatedFileCount: result.files.length, tsconfigPath: result.configFilePath };
  });
  registerInitialAnalysisIpcHandlers({
    ipcMain, senderIsTrusted, validPath, loadInitialAnalysisRun,
    getRepositoryConfiguration: async (projectId) => (await projectModel()).repositoryConfigurationFor(projectId),
    analyze: async (input) => (await loadSymbolIndex()).createSymbolIndex(input),
    beginRun: async (projectId, runId, stagingId) => (await projectModel()).beginAnalysisRun(projectId, runId, stagingId),
    saveBatch: async (batch) => (await projectModel()).saveAnalysisBatch(batch),
    finishRun: async (projectId, runId) => (await projectModel()).finishAnalysisRun(projectId, runId),
    failRun: async (projectId, runId) => (await projectModel()).failAnalysisRun(projectId, runId),
    cancelRun: async (projectId, runId) => (await projectModel()).cancelAnalysisRun(projectId, runId),
    setSymbols: async (projectId, symbols) => (await projectModel()).setCanonicalSymbols(projectId, symbols),
  });
  registerProjectModelIpcHandlers({
    ipcMain, senderIsTrusted, validId: validPath,
    loadCommands: async (projectId) => (await projectModel()).commands(projectId),
    resolveProjectSymbol: async (projectId, symbolId) => (await projectModel()).resolveProjectSymbol(projectId, symbolId),
    configureRepository: async (projectId, repositoryRoot, tsconfigPath) => (await projectModel()).configureRepository(projectId, repositoryRoot, tsconfigPath),
    listProjects: async () => (await projectModel()).listProjects(),
    listSymbols: async (projectId) => (await projectModel()).canonicalSymbols(projectId).map((symbol) => ({ ...symbol, targetScope: "PROJECT" })),
  });

  const createWindow = () => {
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        preload: join(__dirname, "preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    void window.loadFile(join(__dirname, "dist", "renderer", "index.html"));
  };

  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (projectModelRuntime) projectModelRuntime.close();
    if (process.platform !== "darwin") app.quit();
  });
}
