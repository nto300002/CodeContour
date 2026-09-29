import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainProjectModelRuntime } from "../src/main-project-model-runtime.js";

const require = createRequire(import.meta.url);
const { createRuntimeCache, registerAppLifecycle } = require("../electron-runtime-lifecycle.cjs") as {
  createRuntimeCache: (factory: () => Promise<MainProjectModelRuntime>) => {
    get: () => Promise<MainProjectModelRuntime>;
    close: () => Promise<void>;
  };
  registerAppLifecycle: (input: {
    app: { on: (event: string, handler: () => unknown) => void; quit: () => void };
    BrowserWindow: { getAllWindows: () => unknown[] };
    createWindow: () => void;
    closeRuntimes: () => Promise<void>;
    platform: string;
  }) => void;
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Electron SQLite runtime lifecycle", () => {
  it("reopens the database after the last macOS window closes and the app is reactivated", async () => {
    const directory = await mkdtemp(join(tmpdir(), "code-contour-runtime-lifecycle-"));
    temporaryDirectories.push(directory);
    const database = join(directory, "model.sqlite");
    const repositoryRoot = join(directory, "repository");
    const windows: object[] = [];
    const handlers = new Map<string, () => unknown>();
    const app = { on: (event: string, handler: () => unknown) => handlers.set(event, handler), quit: vi.fn() };
    const BrowserWindow = { getAllWindows: () => windows };
    const createWindow = vi.fn(() => { windows.push({}); });
    const runtimeCache = createRuntimeCache(async () => new MainProjectModelRuntime(database));
    registerAppLifecycle({ app, BrowserWindow, createWindow, closeRuntimes: () => runtimeCache.close(), platform: "darwin" });

    const firstRuntime = await runtimeCache.get();
    firstRuntime.configureRepository("project-lifecycle", repositoryRoot, "tsconfig.json");
    const initialEdit = await firstRuntime.commands("project-lifecycle").createFeature("Before close");
    expect(initialEdit).toMatchObject({ ok: true });

    windows.length = 0;
    await handlers.get("window-all-closed")?.();
    expect(app.quit).not.toHaveBeenCalled();
    handlers.get("activate")?.();
    expect(createWindow).toHaveBeenCalledOnce();

    const reopenedRuntime = await runtimeCache.get();
    expect(reopenedRuntime).not.toBe(firstRuntime);
    expect(reopenedRuntime.listProjects()).toMatchObject([{ id: "project-lifecycle", name: "repository" }]);
    const postRestoreEdit = await reopenedRuntime.commands("project-lifecycle").createFeature("After restore");
    expect(postRestoreEdit).toMatchObject({ ok: true });
    expect((await reopenedRuntime.commands("project-lifecycle").load()).features.map((feature) => feature.name).sort()).toEqual([
      "After restore",
      "Before close",
    ]);
    await runtimeCache.close();
  });

  it("quits non-macOS applications after closing their runtime", async () => {
    const handlers = new Map<string, () => unknown>();
    let runtimeClosed = false;
    const app = { on: (event: string, handler: () => unknown) => handlers.set(event, handler), quit: vi.fn() };
    registerAppLifecycle({
      app,
      BrowserWindow: { getAllWindows: () => [] },
      createWindow: vi.fn(),
      closeRuntimes: async () => { runtimeClosed = true; },
      platform: "linux",
    });

    await handlers.get("window-all-closed")?.();

    expect(runtimeClosed).toBe(true);
    expect(app.quit).toHaveBeenCalledOnce();
  });
});
