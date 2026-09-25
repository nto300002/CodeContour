const { app, BrowserWindow } = require("electron");
const { join } = require("node:path");

if (process.env.CODECONTOUR_SQLITE_DRIVER) {
  require("./test/fixtures/sqlite-packaged-main.cjs");
} else {
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
