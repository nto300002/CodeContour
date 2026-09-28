function registerProjectModelIpcHandlers({ ipcMain, senderIsTrusted, validId, loadCommands, resolveProjectSymbol }) {
  const commands = async (event, projectId) => {
    if (!senderIsTrusted(event) || !validId(projectId)) throw new Error("Invalid project.");
    return loadCommands(projectId);
  };
  ipcMain.handle("project-model:load", async (event, input) => (await commands(event, input?.projectId)).load());
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
}

module.exports = { registerProjectModelIpcHandlers };
