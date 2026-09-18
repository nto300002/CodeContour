import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeImportRelations } from "../src/relation-analyzer.js";

const directories: string[] = [];
async function fixture(files: Record<string, string>) { const root = await mkdtemp(join(tmpdir(), "code-contour-relations-")); directories.push(root); await Promise.all(Object.entries(files).map(async ([path, text]) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), text); })); return root; }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("analyzeImportRelations", () => {
  it("resolves relative, alias, default, barrel and chained re-export imports to project definitions", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] }, moduleResolution: "Node" }, include: ["src"] }),
      "src/domain.ts": "export const source = 1; export default function defaultSource() { return source; }",
      "src/barrel.ts": "export { source as renamed } from './domain'; export { default } from './domain';",
      "src/chain.ts": "export { renamed as chained } from './barrel';",
      "src/main.ts": "import defaultSource, { source } from './domain'; import { chained } from './chain'; import { source as aliasSource } from '@/domain'; export const use = () => defaultSource() + source + chained + aliasSource;",
    });
    const result = await analyzeImportRelations({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(result.relations).toHaveLength(4);
    expect(result.relations.map((relation) => [relation.importedName, relation.targetScope, relation.definition?.relativePath])).toEqual([
      ["default", "PROJECT", "src/domain.ts"],
      ["source", "PROJECT", "src/domain.ts"],
      ["chained", "PROJECT", "src/domain.ts"],
      ["source", "PROJECT", "src/domain.ts"],
    ]);
    for (const relation of result.relations) expect(relation).toMatchObject({ type: "IMPORTS", targetScope: "PROJECT", resolution: "RESOLVED", evidenceLocation: { relativePath: "src/main.ts", start: expect.any(Number), end: expect.any(Number) }, definition: { relativePath: "src/domain.ts", range: { start: expect.any(Number), end: expect.any(Number) } } });
  });

  it("marks external and unresolved imports without falsely resolving a project definition", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "import { external } from 'external'; import { missing } from './missing'; export const value = external;", "node_modules/external/index.d.ts": "export declare const external: string;" });
    const result = await analyzeImportRelations({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(result.relations).toEqual(expect.arrayContaining([expect.objectContaining({ importedName: "external", targetScope: "EXTERNAL", resolution: "RESOLVED", definition: undefined }), expect.objectContaining({ importedName: "missing", targetScope: "UNKNOWN", resolution: "UNKNOWN", definition: undefined })]));
  });

  it("does not mark a missing export from a resolved project module as external or resolved", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/domain.ts": "export const present = true;", "src/main.ts": "import { missing } from './domain'; export const value = missing;" });
    const result = await analyzeImportRelations({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(result.relations).toEqual([expect.objectContaining({ importedName: "missing", targetScope: "PROJECT", resolution: "UNKNOWN", definition: undefined })]);
  });

  it("marks a missing export from an existing external package as external but unknown", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "import { missing } from 'external'; export const value = missing;", "node_modules/external/index.d.ts": "export declare const present: string;" });
    const result = await analyzeImportRelations({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(result.relations).toEqual([expect.objectContaining({ importedName: "missing", targetScope: "EXTERNAL", resolution: "UNKNOWN", definition: undefined })]);
  });
});
