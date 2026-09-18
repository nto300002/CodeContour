import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  });

  it("reports parse-failed files separately without discarding other symbols", async () => {
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/good.ts": "export function good(): string { return 'ok'; }", "src/bad.ts": "export function broken( {" });
    const result = await createSymbolIndex({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true, filesWithParseErrors: ["src/bad.ts"] });
    if (result.ok) expect(result.symbols).toEqual(expect.arrayContaining([expect.objectContaining({ name: "good" })]));
  });
});
