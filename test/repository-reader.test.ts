import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTypeScriptProject } from "../src/repository-reader.js";

const temporaryDirectories: string[] = [];

async function createRepository(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "code-contour-reader-"));
  temporaryDirectories.push(root);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = join(root, relativePath);
      await mkdir(join(filePath, ".."), { recursive: true });
      await writeFile(filePath, contents);
    }),
  );

  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("loadTypeScriptProject", () => {
  it("returns TypeScript and TSX application files from a basic tsconfig", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/index.ts": "export const answer = 42;",
      "src/App.tsx": "export const App = () => null;",
      "src/ignored.js": "module.exports = {};",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: true, files: ["src/App.tsx", "src/index.ts"] });
  });

  it("honors extends, baseUrl, paths, moduleResolution, and files", async () => {
    const root = await createRepository({
      "tsconfig.base.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] }, moduleResolution: "Node" } }),
      "tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json", files: ["src/main.ts"] }),
      "src/main.ts": 'import { utility } from "@/utility"; export { utility };',
      "src/utility.ts": "export const utility = true;",
      "src/unlisted.ts": "export const unlisted = true;",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: true, files: ["src/main.ts"] });
    if (result.ok) expect(result.compilerOptions.paths).toEqual({ "@/*": ["src/*"] });
  });

  it("rejects traversal outside the repository root", async () => {
    const root = await createRepository({ "tsconfig.json": "{}" });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "../tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "PATH_OUTSIDE_ROOT" } });
  });

  it("does not index a symlink whose real path is outside the repository root", async () => {
    const root = await createRepository({ "tsconfig.json": JSON.stringify({ include: ["src"] }) });
    const external = await createRepository({ "external.ts": "export const secret = true;" });
    await mkdir(join(root, "src"), { recursive: true });
    await symlink(join(external, "external.ts"), join(root, "src", "external.ts"));

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({
      ok: true,
      files: [],
      skippedFiles: [{ path: "src/external.ts", reason: "PATH_OUTSIDE_ROOT" }],
    });
  });

  it("rejects a tsconfig that extends a configuration outside the repository root", async () => {
    const root = await createRepository({ "tsconfig.json": JSON.stringify({ extends: "../tsconfig.base.json" }) });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "PATH_OUTSIDE_ROOT" } });
  });

  it("rejects every member of an extends array when one escapes the repository root", async () => {
    const root = await createRepository({
      "tsconfig.base.json": "{}",
      "tsconfig.json": JSON.stringify({ extends: ["./tsconfig.base.json", "../external.json"] }),
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "PATH_OUTSIDE_ROOT" } });
  });

  it("returns an observable exclusion for an out-of-root file declared by tsconfig", async () => {
    const root = await createRepository({ "tsconfig.json": JSON.stringify({ files: ["../outside.ts"] }) });
    const external = await createRepository({ "outside.ts": "export const outside = true;" });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({
      ok: true,
      files: [],
      skippedFiles: [{ path: "../outside.ts", reason: "PATH_OUTSIDE_ROOT" }],
    });
    expect(external).toBeTruthy();
  });

  it("applies .gitignore to the application index", async () => {
    const root = await createRepository({
      ".gitignore": "src/private.ts\nsrc/*.generated.ts\n",
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/public.ts": "export const visible = true;",
      "src/private.ts": "export const hidden = true;",
      "src/client.generated.ts": "export const generated = true;",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: true, files: ["src/public.ts"] });
  });

  it("applies a nested .gitignore to files below its directory", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const visible = true;",
      "src/generated/.gitignore": "*.ts\n",
      "src/generated/client.ts": "export const generated = true;",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({
      ok: true,
      files: ["src/main.ts"],
      skippedFiles: expect.arrayContaining([{ path: "src/generated/client.ts", reason: "GITIGNORE" }]),
    });
  });

  it("rejects a .gitignore symlink that resolves outside the repository root", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const visible = true;",
    });
    const external = await createRepository({ "ignore": "src/main.ts\n" });
    await symlink(join(external, "ignore"), join(root, ".gitignore"));

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "PATH_OUTSIDE_ROOT" } });
  });

  it("honors .gitignore rules on the logical path of an in-root symlink", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ files: ["src/linked/secret.ts"] }),
      "src/.gitignore": "linked/\n",
      "shared/secret.ts": "export const secret = true;",
    });
    await mkdir(join(root, "src"), { recursive: true });
    await symlink(join(root, "shared"), join(root, "src", "linked"));

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({
      ok: true,
      files: [],
      skippedFiles: expect.arrayContaining([{ path: "src/linked/secret.ts", reason: "GITIGNORE" }]),
    });
  });

  it("fails closed when a .gitignore cannot be read", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const visible = true;",
      ".gitignore/invalid": "not a file",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "REPOSITORY_READ_ERROR" } });
  });

  it("excludes node_modules and .git from the application index", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ include: ["src", "node_modules", ".git"] }),
      "src/main.ts": "export const application = true;",
      "node_modules/library/index.d.ts": "export declare const library: true;",
      ".git/hidden.ts": "export const hidden = true;",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: true, files: ["src/main.ts"] });
  });

  it("applies built-in security ignore rules independently of .gitignore", async () => {
    const root = await createRepository({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const application = true;",
      "src/credentials/token.ts": "export const token = 'secret';",
      "src/private.key.ts": "export const key = 'secret';",
    });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({
      ok: true,
      files: ["src/main.ts"],
      skippedFiles: expect.arrayContaining([
        { path: "src/credentials/token.ts", reason: "SECURITY_IGNORE" },
        { path: "src/private.key.ts", reason: "SECURITY_IGNORE" },
      ]),
    });
  });

  it("returns an observable error when tsconfig does not exist", async () => {
    const root = await createRepository({});

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "TSCONFIG_NOT_FOUND" } });
  });

  it("returns an observable error for an unparseable tsconfig", async () => {
    const root = await createRepository({ "tsconfig.json": "{ invalid json" });

    const result = await loadTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });

    expect(result).toMatchObject({ ok: false, error: { code: "TSCONFIG_PARSE_ERROR" } });
  });
});
