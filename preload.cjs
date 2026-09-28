const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codeContour", Object.freeze({
  repositorySetup: Object.freeze({
    pickRoot: () => ipcRenderer.invoke("repository-setup:pick-root"),
    pickTsconfig: (repositoryRoot) => ipcRenderer.invoke("repository-setup:pick-tsconfig", repositoryRoot),
    validate: (input) => ipcRenderer.invoke("repository-setup:validate", input),
  }),
  initialAnalysis: Object.freeze({
    start: (input) => ipcRenderer.invoke("initial-analysis:start", input),
    cancel: (input) => ipcRenderer.invoke("initial-analysis:cancel", input),
  }),
}));
