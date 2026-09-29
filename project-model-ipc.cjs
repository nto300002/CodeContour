function registerProjectModelIpcHandlers({ ipcMain, senderIsTrusted, validId, loadCommands, resolveProjectSymbol, configureRepository, listProjects, listSymbols }) {
  const commands = async (event, projectId) => {
    if (!senderIsTrusted(event) || !validId(projectId)) throw new Error("Invalid project.");
    return loadCommands(projectId);
  };
  ipcMain.handle("project-model:load", async (event, input) => (await commands(event, input?.projectId)).load());
  ipcMain.handle("project-model:list-projects", async (event) => {
    if (!senderIsTrusted(event)) throw new Error("Untrusted IPC sender.");
    return listProjects();
  });
  ipcMain.handle("project-model:list-symbols", async (event, input) => {
    if (!senderIsTrusted(event) || !validId(input?.projectId)) throw new Error("Invalid project.");
    return listSymbols ? listSymbols(input.projectId) : [];
  });
  ipcMain.handle("project-model:configure-repository", async (event, input) => {
    await commands(event, input?.projectId);
    if (!validId(input?.repositoryRoot) || !validId(input?.tsconfigPath)) throw new Error("Invalid repository configuration.");
    return configureRepository(input.projectId, input.repositoryRoot, input.tsconfigPath);
  });
  ipcMain.handle("project-model:create-feature", async (event, input) => (await commands(event, input?.projectId)).createFeature(input?.name ?? ""));
  ipcMain.handle("project-model:create-process", async (event, input) => (await commands(event, input?.projectId)).createProcess({ featureId: input?.featureId, name: input?.name ?? "", firstStepName: input?.firstStepName ?? "" }));
  ipcMain.handle("project-model:create-data-flow", async (event, input) => (await commands(event, input?.projectId)).createDataFlow({ fromProcessId: input?.fromProcessId ?? "", toProcessId: input?.toProcessId ?? "", label: input?.label ?? "" }));
  ipcMain.handle("project-model:add-evidence", async (event, input) => {
    const projectId = input?.projectId;
    const service = await commands(event, projectId);
    if (!validId(input?.dataFlowId) || !validId(input?.symbolId)) throw new Error("Invalid evidence command.");
    const resolved = await resolveProjectSymbol(projectId, input.symbolId);
    if (!resolved || resolved.targetScope !== "PROJECT") return { ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } };
    return service.addDataFlowEvidence({ dataFlowId: input.dataFlowId, targetScope: resolved.targetScope, symbol: resolved.symbol });
  });
  ipcMain.handle("project-model:execute", async (event, input) => {
    const service = await commands(event, input?.projectId);
    const command = input?.command;
    if (!command || typeof command !== "object" || typeof command.type !== "string") throw new Error("Invalid Project Model command.");
    const idFields = { "feature.rename": ["featureId"], "feature.archive": ["featureId"], "process.rename": ["processId"], "process.delete": ["processId"], "process.move": ["processId"], "flow.rename": ["dataFlowId"], "flow.update-endpoints": ["dataFlowId", "fromProcessId", "toProcessId"], "flow.delete": ["dataFlowId"] };
    const requiredIds = idFields[command.type];
    if (!requiredIds || requiredIds.some((field) => !validId(command[field]))) throw new Error("Invalid Project Model command.");
    if (command.type === "process.move" && command.direction !== -1 && command.direction !== 1) throw new Error("Invalid Process ordering command.");
    if (["feature.rename", "process.rename"].includes(command.type) && typeof command.name !== "string") throw new Error("Invalid name command.");
    if (command.type === "flow.rename" && typeof command.label !== "string") throw new Error("Invalid Data Flow command.");
    return service.execute(command);
  });
}

module.exports = { registerProjectModelIpcHandlers };
