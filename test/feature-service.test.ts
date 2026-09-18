import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureService, FeatureViewController, UserModelFileStore, featureViewItems, loadSelectedProject } from "../src/feature-service.js";

const directories: string[] = [];
async function modelPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "code-contour-feature-"));
  directories.push(directory);
  return join(directory, "user-model.json");
}
async function repositoryFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "code-contour-feature-repository-"));
  directories.push(root);
  await Promise.all(Object.entries(files).map(async ([path, contents]) => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), contents);
  }));
  return root;
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("FeatureService", () => {
  it("creates a confirmed user feature and exposes it in the Feature View", async () => {
    const path = await modelPath();
    const service = new FeatureService(new UserModelFileStore(path, "project-1"), { id: "project-1", repositoryLoaded: true }, () => "feature-1");

    const result = await service.createFeature("Authentication");

    expect(result).toEqual({ ok: true, feature: {
      id: "feature-1", name: "Authentication", origin: "USER", confirmation: "CONFIRMED",
    } });
    expect(featureViewItems(await service.load())).toEqual([{ id: "feature-1", label: "Authentication" }]);
  });

  it("rejects a blank name without changing the stored model", async () => {
    const path = await modelPath();
    const service = new FeatureService(new UserModelFileStore(path, "project-1"), { id: "project-1", repositoryLoaded: true }, () => "feature-1");

    expect(await service.createFeature("   ")).toEqual({ ok: false, error: { code: "NAME_REQUIRED" } });
    expect(await service.load()).toEqual({ version: 1, projectId: "project-1", features: [], processes: [] });
  });

  it("persists the user model and reloads the created feature", async () => {
    const path = await modelPath();
    const service = new FeatureService(new UserModelFileStore(path, "project-1"), { id: "project-1", repositoryLoaded: true }, () => "feature-1");
    await service.createFeature("Authentication");

    const reloaded = new FeatureService(new UserModelFileStore(path, "project-1"), { id: "project-1", repositoryLoaded: true }, () => "feature-2");
    expect(await reloaded.load()).toMatchObject({ features: [{ id: "feature-1", name: "Authentication", origin: "USER", confirmation: "CONFIRMED" }] });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ projectId: "project-1", features: [{ id: "feature-1" }] });
  });

  it("leaves an existing persisted model unchanged when the name guard fails", async () => {
    const path = await modelPath();
    const service = new FeatureService(new UserModelFileStore(path, "project-1"), { id: "project-1", repositoryLoaded: true }, () => "feature-1");
    await service.createFeature("Authentication");
    const before = await readFile(path, "utf8");

    expect(await service.createFeature(" \n ")).toEqual({ ok: false, error: { code: "NAME_REQUIRED" } });
    expect(await readFile(path, "utf8")).toBe(before);
    expect((await service.load()).features).toHaveLength(1);
  });

  it("does not create a feature until the selected repository project is loaded", async () => {
    const path = await modelPath();
    const service = new FeatureService(new UserModelFileStore(path, "project-1"), { id: "project-1", repositoryLoaded: false }, () => "feature-1");

    expect(await service.createFeature("Authentication")).toEqual({ ok: false, error: { code: "PROJECT_NOT_READY" } });
    expect(await service.load()).toEqual({ version: 1, projectId: "project-1", features: [], processes: [] });
  });

  it("creates and displays a feature through the repository-to-Feature View flow", async () => {
    const root = await repositoryFixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "export const ready = true;" });
    const project = await loadSelectedProject({ id: "project-1", repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    const service = new FeatureService(new UserModelFileStore(join(root, "user-model.json"), "project-1"), project, () => "feature-1");
    const view = new FeatureViewController(service);

    expect(await view.submit("Authentication")).toEqual({
      features: [{ id: "feature-1", label: "Authentication" }], validationError: undefined,
    });
    expect(await view.submit(" ")).toEqual({
      features: [{ id: "feature-1", label: "Authentication" }], validationError: "NAME_REQUIRED",
    });
  });

  it("does not write a model when Repository Reader cannot load the selected project", async () => {
    const root = await repositoryFixture({ "src/main.ts": "export const unavailable = true;" });
    const path = join(root, "user-model.json");
    const project = await loadSelectedProject({ id: "project-1", repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    const service = new FeatureService(new UserModelFileStore(path, "project-1"), project, () => "feature-1");

    expect(project.repositoryLoaded).toBe(false);
    expect(await service.createFeature("Authentication")).toEqual({ ok: false, error: { code: "PROJECT_NOT_READY" } });
    await expect(readFile(path, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
