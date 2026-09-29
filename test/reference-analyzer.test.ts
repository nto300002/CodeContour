import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { symlink } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeStaticReferences } from "../src/reference-analyzer.js";

const directories: string[] = [];
async function fixture(files: Record<string, string>) { const root = await mkdtemp(join(tmpdir(), "code-contour-references-")); directories.push(root); await Promise.all(Object.entries(files).map(async ([path, text]) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), text); })); return root; }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("analyzeStaticReferences", () => {
  it("records project value and type references with definition locations", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/domain.ts": "export const value = 1; export function greet() { return value; } export class Service { run() { return greet(); } } export interface User { id: string } export type Result = User;",
      "src/main.ts": "import { greet as renamed, Service, value, type Result } from './domain'; const local = value; const service = new Service(); const answer: Result = { id: renamed() + String(local) }; service.run();",
    });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(result.references).toEqual(expect.arrayContaining([expect.objectContaining({ targetName: "greet", kind: "VALUE", from: expect.objectContaining({ relativePath: "src/main.ts", qualifiedName: "answer" }), to: expect.objectContaining({ relativePath: "src/domain.ts", qualifiedName: "greet" }) }), expect.objectContaining({ targetName: "Service", kind: "VALUE" }), expect.objectContaining({ targetName: "value", kind: "VALUE" }), expect.objectContaining({ targetName: "Result", kind: "TYPE" })]));
    expect(result.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetName: "run",
        from: expect.objectContaining({ qualifiedName: "<file>", relativePath: "src/main.ts" }),
        to: expect.objectContaining({ qualifiedName: "Service.run", relativePath: "src/domain.ts", range: { start: expect.any(Number), end: expect.any(Number) } }),
      }),
    ]));
  });

  it("does not turn declarations, strings, comments, dynamic access, or external symbols into project references", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "// external\nconst text = 'value'; const object: Record<string, number> = { value: 1 }; const key = 'value'; object[key];" });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.references.map((reference) => reference.targetName)).not.toContain("value");
  });

  it("does not emit object, interface, or type property names as references", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "interface User { id: string } type Result = { value: User }; const object = { value: 1 };" });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (result.ok) expect(result.references.map((reference) => reference.targetName)).not.toEqual(expect.arrayContaining(["id", "value"]));
  });

  it("distinguishes same-name definitions by file and resolves an interface type reference", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/a.ts": "export function duplicate() {}",
      "src/b.ts": "export function duplicate() {}",
      "src/domain.ts": "export interface User { id: string }",
      "src/main.ts": "import { duplicate as a } from './a'; import { duplicate as b } from './b'; import type { User } from './domain'; export function run(user: User) { a(); b(); return user.id; }",
    });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    const duplicates = result.references.filter((reference) => reference.targetName === "duplicate");
    expect(duplicates.map((reference) => reference.to.relativePath).sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(new Set(duplicates.map((reference) => `${reference.to.relativePath}:${reference.to.range.start}:${reference.to.range.end}`)).size).toBe(2);
    expect(result.references).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "TYPE", targetName: "User", to: expect.objectContaining({ qualifiedName: "User", relativePath: "src/domain.ts" }) })]));
  });

  it("uses definition ranges that slice to the actual source declaration", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/domain.ts": "export function greet() { return 'hi'; }", "src/main.ts": "import { greet } from './domain'; export function run() { return greet(); }" });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    const reference = result.references.find((item) => item.targetName === "greet");
    expect(reference).toBeDefined();
    const source = await readFile(join(root, reference!.definition.relativePath), "utf8");
    expect(source.slice(reference!.definition.range.start, reference!.definition.range.end)).toBe("export function greet() { return 'hi'; }");
  });

  it("uses an external declaration for typing without emitting a project static reference", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "node_modules/external/index.d.ts": "export declare function external(): string;", "src/main.ts": "import { external } from 'external'; export function run() { return external(); }" });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (result.ok) expect(result.references.every((reference) => reference.targetName !== "external" && !reference.to.relativePath.includes("node_modules"))).toBe(true);
  });

  it("does not create a reference for an implementation file excluded by .gitignore", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), ".gitignore": "src/private.ts\n", "src/private.ts": "export const privateValue = 1;", "src/main.ts": "import { privateValue } from './private'; export function run() { return privateValue; }" });
    const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true }); if (result.ok) expect(result.references.map((reference) => reference.targetName)).not.toContain("privateValue");
  });

  it("does not create a reference for an implementation file outside the repository root", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "import { outsideValue } from '../../outside.ts'; export function run() { return outsideValue; }" });
    const outside = join(root, "..", "outside.ts"); await writeFile(outside, "export const outsideValue = 1;");
    try { const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" }); expect(result).toMatchObject({ ok: true }); if (result.ok) expect(result.references.map((reference) => reference.targetName)).not.toContain("outsideValue"); } finally { await rm(outside, { force: true }); }
  });

  it("does not create a reference through a symlink whose implementation resolves outside the repository root", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "import { linkedValue } from './linked'; export function run() { return linkedValue; }" });
    const outside = join(root, "..", "linked.ts"); await writeFile(outside, "export const linkedValue = 1;"); await symlink(outside, join(root, "src", "linked.ts"));
    try { const result = await analyzeStaticReferences({ repositoryRoot: root, tsconfigPath: "tsconfig.json" }); expect(result).toMatchObject({ ok: true }); if (result.ok) expect(result.references.map((reference) => reference.targetName)).not.toContain("linkedValue"); } finally { await rm(outside, { force: true }); }
  });
});
