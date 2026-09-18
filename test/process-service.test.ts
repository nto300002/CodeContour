import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureService, UserModelFileStore, loadSelectedProject } from "../src/feature-service.js";
import { ProcessService, ProcessViewController, processViewItems } from "../src/process-service.js";

const directories: string[] = [];
async function modelPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "code-contour-process-"));
  directories.push(directory);
  return join(directory, "user-model.json");
}
async function repositoryFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "code-contour-process-repository-"));
  directories.push(root);
  await Promise.all(Object.entries(files).map(async ([path, contents]) => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), contents);
  }));
  return root;
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const readyProject = { id: "project-1", repositoryLoaded: true } as const;

describe("ProcessService", () => {
  it("creates a user process with an ordered minimum step under its selected feature", async () => {
    const path = await modelPath();
    const store = new UserModelFileStore(path, "project-1");
    const features = new FeatureService(store, readyProject, () => "feature-1");
    await features.createFeature("Authentication");
    const ids = ["process-1", "step-1"];
    const service = new ProcessService(store, readyProject, () => ids.shift()!);

    expect(await service.createProcess({ featureId: "feature-1", name: "Sign in", firstStepName: "Validate credentials" })).toEqual({ ok: true, process: {
      id: "process-1", featureId: "feature-1", name: "Sign in", origin: "USER", confirmation: "CONFIRMED",
      steps: [{ id: "step-1", name: "Validate credentials", order: 0 }],
    } });
    expect(processViewItems(await service.load(), "feature-1")).toEqual([{ id: "process-1", label: "Sign in", steps: ["Validate credentials"] }]);
  });

  it("rejects a missing selection, blank process name, or blank minimum step without changing the model", async () => {
    const path = await modelPath();
    const store = new UserModelFileStore(path, "project-1");
    const features = new FeatureService(store, readyProject, () => "feature-1");
    await features.createFeature("Authentication");
    const service = new ProcessService(store, readyProject, () => "unused");
    const before = await readFile(path, "utf8");

    expect(await service.createProcess({ name: "Sign in", firstStepName: "Start" })).toEqual({ ok: false, error: { code: "FEATURE_NOT_SELECTED" } });
    expect(await service.createProcess({ featureId: "feature-1", name: " ", firstStepName: "Start" })).toEqual({ ok: false, error: { code: "PROCESS_NAME_REQUIRED" } });
    expect(await service.createProcess({ featureId: "feature-1", name: "Sign in", firstStepName: " " })).toEqual({ ok: false, error: { code: "STEP_NAME_REQUIRED" } });
    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("reloads the feature-to-process relation and displays it through the selected Process View", async () => {
    const root = await repositoryFixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "export const ready = true;" });
    const path = join(root, "user-model.json");
    const project = await loadSelectedProject({ id: "project-1", repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    const store = new UserModelFileStore(path, "project-1");
    await new FeatureService(store, project, () => "feature-1").createFeature("Authentication");
    const ids = ["process-1", "step-1"];
    const service = new ProcessService(store, project, () => ids.shift()!);
    const view = new ProcessViewController(service);

    view.selectFeature("feature-1");
    expect(await view.submit("Sign in", "Validate credentials")).toEqual({
      processes: [{ id: "process-1", label: "Sign in", steps: ["Validate credentials"] }], validationError: undefined,
    });
    const reloaded = new ProcessService(new UserModelFileStore(path, "project-1"), project, () => "unused");
    expect((await reloaded.load()).processes).toMatchObject([{ featureId: "feature-1", name: "Sign in" }]);
  });

  it("migrates a persisted version 1 model without processes and preserves it after saving a process", async () => {
    const path = await modelPath();
    await writeFile(path, JSON.stringify({
      version: 1, projectId: "project-1",
      features: [{ id: "feature-1", name: "Authentication", origin: "USER", confirmation: "CONFIRMED" }],
    }), "utf8");
    const ids = ["process-1", "step-1"];
    const service = new ProcessService(new UserModelFileStore(path, "project-1"), readyProject, () => ids.shift()!);

    expect(await service.load()).toEqual({
      version: 1, projectId: "project-1",
      features: [{ id: "feature-1", name: "Authentication", origin: "USER", confirmation: "CONFIRMED" }],
      processes: [],
      processSymbolLinks: [],
    });
    await service.createProcess({ featureId: "feature-1", name: "Sign in", firstStepName: "Validate credentials" });
    const reloaded = await new UserModelFileStore(path, "project-1").load();
    expect(reloaded).toMatchObject({
      features: [{ id: "feature-1", name: "Authentication" }],
      processes: [{ id: "process-1", featureId: "feature-1", steps: [{ id: "step-1", order: 0 }] }],
    });
  });
});
