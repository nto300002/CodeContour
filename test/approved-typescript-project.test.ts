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
});
