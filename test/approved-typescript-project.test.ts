import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openApprovedTypeScriptProject } from "../src/approved-typescript-project.js";

describe("ApprovedTypeScriptProject", () => {
  it("gives every Analyzer one approved Application File set while allowing declaration-only dependencies", async () => {
    const root = await mkdtemp(join(tmpdir(), "code-contour-approved-"));
    const outside = await mkdtemp(join(tmpdir(), "code-contour-outside-"));
    await mkdir(join(root, "src")); await writeFile(join(root, "tsconfig.json"), JSON.stringify({ include: ["src"] }));
    await writeFile(join(root, "src/main.ts"), "import { external } from 'pkg'; export const app = external;");
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true }); await writeFile(join(root, "node_modules", "pkg", "index.d.ts"), "export declare const external: string;");
    await writeFile(join(outside, "outside.ts"), "export const outside = 1;"); await symlink(join(outside, "outside.ts"), join(root, "src", "escape.ts"));
    const approved = await openApprovedTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    if (!approved.ok) throw new Error(approved.error.message);
    expect([...approved.applicationFiles]).toEqual(["src/main.ts"]);
    expect(approved.toProjectPath(join(root, "node_modules", "pkg", "index.d.ts"))).toBe("node_modules/pkg/index.d.ts");
    expect(approved.toProjectPath(join(outside, "outside.ts"))).toBeUndefined();
  });

  it("blocks ignored and root-external implementations through imports and triple-slash references", async () => {
    const root = await mkdtemp(join(tmpdir(), "code-contour-approved-boundary-"));
    const outside = await mkdtemp(join(tmpdir(), "code-contour-approved-outside-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ include: ["src"] }));
    await writeFile(join(root, ".gitignore"), "src/ignored.ts\n");
    await writeFile(join(root, "src/main.ts"), '/// <reference path="../../outside.ts" />\nimport { ignored } from "./ignored"; export const visible = ignored;');
    await writeFile(join(root, "src/ignored.ts"), "export const ignored = 'must-not-enter-program';");
    await writeFile(join(outside, "outside.ts"), "export const outsideSecret = 'must-not-enter-program';");
    await symlink(join(outside, "outside.ts"), join(root, "src/linked.ts"));
    const approved = await openApprovedTypeScriptProject({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    if (!approved.ok) throw new Error(approved.error.message);
    const loaded = approved.program.getSourceFiles().map((file) => approved.toProjectPath(file.fileName) ?? file.fileName);
    expect([...approved.applicationFiles]).toEqual(["src/main.ts"]);
    expect(loaded).not.toContain("src/ignored.ts");
    expect(loaded.some((file) => file.includes("outside.ts"))).toBe(false);
    expect(loaded).not.toContain("src/linked.ts");
  });
});
