import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { createSymbolIndex } from "../src/symbol-index.js";

const directories: string[] = [];
async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "code-contour-symbols-")); directories.push(root);
  await Promise.all(Object.entries(files).map(async ([path, value]) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), value); }));
  return root;
}
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe("createSymbolIndex", () => {
  it("indexes supported application symbols with stable required IR fields and signatures", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/model.ts": `export interface User { id: string }\nexport type Result<T> = { value: T };\nexport function greet(name: string): Result<string> { return { value: name }; }\nexport const arrow: (id: number) => string = (id) => String(id);\nexport class Service { run(input: User): void {} static create<T>(value: T): T { return value; } }\nexport function overloaded(value: string): string; export function overloaded(value: number): number; export function overloaded(value: string | number) { return value; }`,
      "node_modules/external/index.d.ts": "export declare function external(): void;",
    });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filesWithParseErrors).toEqual([]);
    expect(result.symbols.map((symbol) => symbol.name)).toEqual(expect.arrayContaining(["User", "Result", "greet", "arrow", "Service", "run", "create", "overloaded"]));
    expect(result.symbols).toEqual(expect.not.arrayContaining([expect.objectContaining({ relativePath: expect.stringContaining("node_modules") })]));
    for (const symbol of result.symbols) expect(symbol).toMatchObject({ id: expect.any(String), kind: expect.any(String), name: expect.any(String), qualifiedName: expect.any(String), relativePath: "src/model.ts", range: { start: expect.any(Number), end: expect.any(Number) }, signature: expect.any(String) });
    expect(result.symbols.find((symbol) => symbol.name === "greet")?.signature).toContain("name: string");
    expect(result.symbols.find((symbol) => symbol.name === "User")?.signature).toContain("id: string");
    expect(result.symbols.find((symbol) => symbol.name === "Result")?.signature).toContain("value: T");
  });

  it("reports parse-failed files separately without discarding other symbols", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/good.ts": "export function good(): string { return 'ok'; }", "src/bad.ts": "export function broken( {" });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true, filesWithParseErrors: ["src/bad.ts"] });
    if (result.ok) expect(result.symbols).toEqual(expect.arrayContaining([expect.objectContaining({ name: "good" })]));
  });

  it("only indexes reader-approved files even when excluded code is imported", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      ".gitignore": "src/private.ts\n",
      "src/main.ts": "import { privateValue } from './private'; export const publicValue = () => privateValue;",
      "src/private.ts": "export const privateValue = 1;",
    });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.symbols.map((symbol) => symbol.name)).toEqual(["publicValue"]);
  });

  it("distinguishes same-name symbols by file and scope, and omits anonymous functions", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/a.ts": "export function duplicate() {} export const anonymous = function() {}; export class A { duplicate() {} }",
      "src/b.ts": "export function duplicate() {}",
    });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const duplicates = result.symbols.filter((symbol) => symbol.name === "duplicate");
    expect(new Set(duplicates.map((symbol) => symbol.id)).size).toBe(3);
    expect(duplicates.map((symbol) => symbol.qualifiedName)).toEqual(expect.arrayContaining(["duplicate", "A.duplicate"]));
    expect(result.symbols.map((symbol) => symbol.qualifiedName)).not.toContain("<anonymous>");
  });

  it("uses external declarations for type resolution without indexing their symbols", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ compilerOptions: { moduleResolution: "Node" }, include: ["src"] }),
      "src/main.ts": "import type { External } from 'external'; export const value = (): External => ({ id: '1' });",
      "node_modules/external/index.d.ts": "export interface External { id: string }",
    });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) { expect(result.symbols).toEqual(expect.arrayContaining([expect.objectContaining({ name: "value", signature: "() => External" })])); expect(result.symbols.every((symbol) => !symbol.relativePath.includes("node_modules"))).toBe(true); }
  });

  it("does not read a triple-slash declaration outside the allowed external package roots", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "/// <reference path='../../external.d.ts' />\nexport const local = () => 1;",
    });
    const externalPath = join(root, "..", "external.d.ts");
    await writeFile(externalPath, "declare const leaked: string;");
    try {
      const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.symbols.map((symbol) => symbol.name)).toEqual(["local"]);
    } finally {
      await rm(externalPath, { force: true });
    }
  });

  it("uses an in-repository declaration file for type resolution without indexing it", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/globals.d.ts": "interface DomainUser { id: string }",
      "src/main.ts": "export const createUser = (): DomainUser => ({ id: '1' });",
    });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.symbols).toEqual(expect.arrayContaining([expect.objectContaining({ name: "createUser", signature: "() => DomainUser" })]));
      expect(result.symbols.every((symbol) => symbol.relativePath !== "src/globals.d.ts")).toBe(true);
    }
  });

  it("matches the saved expected IR projection", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": "export function expected(input: string): number { return input.length; }" });
    const expected = JSON.parse(await readFile(new URL("./fixtures/symbol-index.expected.json", import.meta.url), "utf8"));
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.symbols.map(({ id: _id, range: _range, ...symbol }) => symbol)).toEqual(expected);
  });
});
