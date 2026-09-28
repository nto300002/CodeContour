import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainPath = fileURLToPath(new URL("../electron-main.cjs", import.meta.url));
const preloadPath = fileURLToPath(new URL("../preload.cjs", import.meta.url));

describe("Electron app shell boundary", () => {
  it("loads the built renderer with a sandboxed, isolated preload", async () => {
    const [main, preload] = await Promise.all([readFile(mainPath, "utf8"), readFile(preloadPath, "utf8")]);

    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('sandbox: true');
    expect(main).toContain('dist", "renderer", "index.html');
    expect(preload).toContain("contextBridge.exposeInMainWorld");
    expect(preload).toContain("ipcRenderer.invoke(\"repository-setup:pick-root\")");
    expect(preload).toContain("ipcRenderer.invoke(\"repository-setup:pick-tsconfig\"");
    expect(preload).toContain("ipcRenderer.invoke(\"repository-setup:validate\"");
    expect(preload).not.toContain("ipcRenderer.send");
    expect(preload).not.toContain("window.fs");
  });
});
