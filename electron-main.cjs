const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

if (process.env.CODECONTOUR_SQLITE_DRIVER) {
  require("./test/fixtures/sqlite-packaged-main.cjs");
} else {
  const senderIsTrusted = (event) => event.senderFrame && event.senderFrame.url.startsWith("file:");
  const validPath = (value) => typeof value === "string" && value.length > 0;
  const loadRepositoryReader = async () => import(pathToFileURL(join(__dirname, "dist", "main", "src", "repository-reader.js")).href);
  const analysisRuns = new Map();
  const loadInitialAnalysisRun = async () => import(pathToFileURL(join(__dirname, "dist", "main", "src", "initial-analysis-run.js")).href);

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
  ipcMain.handle("initial-analysis:start", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.projectId)) throw new Error("Invalid project.");
    const { InitialAnalysisRunController } = await loadInitialAnalysisRun();
    const runId = `initial:${input.projectId}:${Date.now()}`;
    const controller = new InitialAnalysisRunController(`active:${input.projectId}`);
    controller.start({ analysisRunId: runId, stagingSnapshotId: `staging:${runId}` });
    analysisRuns.set(runId, controller);
    return { runId, status: controller.status, phase: "Indexing source files" };
  });
  ipcMain.handle("initial-analysis:cancel", async (event, input) => {
    if (!senderIsTrusted(event) || !input || !validPath(input.runId)) throw new Error("Invalid analysis run.");
    const controller = analysisRuns.get(input.runId);
    if (!controller) throw new Error("Analysis run is unavailable.");
    controller.cancel();
    return { status: controller.status, phase: "Cancelled by user" };
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
    if (process.platform !== "darwin") app.quit();
  });
}
