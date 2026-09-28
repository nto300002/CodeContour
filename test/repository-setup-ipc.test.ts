import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainPath = fileURLToPath(new URL("../electron-main.cjs", import.meta.url));
const preloadPath = fileURLToPath(new URL("../preload.cjs", import.meta.url));
const analysisIpcPath = fileURLToPath(new URL("../initial-analysis-ipc.cjs", import.meta.url));

describe("Repository Setup file picker boundary", () => {
  it("exposes only typed picker and validation capabilities through preload", async () => {
    const [main, preload, analysisIpc] = await Promise.all([readFile(mainPath, "utf8"), readFile(preloadPath, "utf8"), readFile(analysisIpcPath, "utf8")]);
    for (const channel of ["repository-setup:pick-root", "repository-setup:pick-tsconfig", "repository-setup:validate"]) {
      expect(main).toContain(`ipcMain.handle(\"${channel}\"`);
      expect(preload).toContain(`ipcRenderer.invoke(\"${channel}\"`);
    }
    for (const channel of ["initial-analysis:start", "initial-analysis:cancel"]) {
      expect(analysisIpc).toContain(`ipcMain.handle(\"${channel}\"`);
      expect(preload).toContain(`ipcRenderer.invoke(\"${channel}\"`);
    }
    expect(main).toContain("registerInitialAnalysisIpcHandlers");
    expect(main).toContain("loadTypeScriptProject(input)");
    expect(preload).not.toContain("ipcRenderer.on");
    expect(preload).not.toContain("require(\"node:fs\")");
  });
});
