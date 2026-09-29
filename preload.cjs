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
    status: (input) => ipcRenderer.invoke("initial-analysis:status", input),
    current: (input) => ipcRenderer.invoke("initial-analysis:current", input),
  }),
  projectModel: Object.freeze({
    load: (projectId) => ipcRenderer.invoke("project-model:load", { projectId }),
    listProjects: () => ipcRenderer.invoke("project-model:list-projects"),
    listSymbols: (projectId) => ipcRenderer.invoke("project-model:list-symbols", { projectId }),
    configureRepository: (input) => ipcRenderer.invoke("project-model:configure-repository", input),
    createFeature: (input) => ipcRenderer.invoke("project-model:create-feature", input),
    createProcess: (input) => ipcRenderer.invoke("project-model:create-process", input),
    createDataFlow: (input) => ipcRenderer.invoke("project-model:create-data-flow", input),
    addEvidence: (input) => ipcRenderer.invoke("project-model:add-evidence", input),
    execute: (input) => ipcRenderer.invoke("project-model:execute", input),
  }),
}));
