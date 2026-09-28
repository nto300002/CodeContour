import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { registerProjectModelIpcHandlers } = require("../project-model-ipc.cjs") as { registerProjectModelIpcHandlers: (input: {
  ipcMain: { handle: (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => void };
  senderIsTrusted: () => boolean; validId: (value: unknown) => boolean; loadCommands: () => Promise<Record<string, (...args: never[]) => unknown>>; resolveProjectSymbol: (projectId: string, symbolId: string) => Promise<unknown>;
}) => void };

describe("Project Model IPC", () => {
  it("uses Main-resolved canonical Project Symbols for Evidence and rejects unknown symbols", async () => {
    const handlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
    const calls: unknown[] = [];
    registerProjectModelIpcHandlers({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, senderIsTrusted: () => true, validId: (value) => typeof value === "string" && value.length > 0,
      loadCommands: async () => ({ addDataFlowEvidence: async (input: unknown) => { calls.push(input); return { ok: true }; }, load: async () => ({}), createFeature: async () => ({}), createProcess: async () => ({}), createDataFlow: async () => ({}) }),
      resolveProjectSymbol: async (_projectId, symbolId) => symbolId === "project-symbol" ? { targetScope: "PROJECT", symbol: { id: "project-symbol", relativePath: "src/auth.ts", range: { start: 1, end: 2 } } } : undefined,
    });
    const addEvidence = handlers.get("project-model:add-evidence");
    if (!addEvidence) throw new Error("IPC handler missing");
    await expect(addEvidence({}, { projectId: "p", dataFlowId: "flow", symbolId: "external" })).resolves.toEqual({ ok: false, error: { code: "SOURCE_NAVIGATION_UNAVAILABLE" } });
    await expect(addEvidence({}, { projectId: "p", dataFlowId: "flow", symbolId: "project-symbol" })).resolves.toEqual({ ok: true });
    expect(calls).toEqual([{ dataFlowId: "flow", targetScope: "PROJECT", symbol: { id: "project-symbol", relativePath: "src/auth.ts", range: { start: 1, end: 2 } } }]);
  });
});
