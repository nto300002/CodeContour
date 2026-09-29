import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeCalls } from "../src/call-analyzer.js";
import { analyzeImportRelations } from "../src/relation-analyzer.js";
import { analyzeStaticReferences } from "../src/reference-analyzer.js";
import { createSymbolIndex } from "../src/symbol-index.js";

describe("shared Analyzer file boundary", () => {
  it("gives all four TypeScript Analyzers the same approved Application File set", async () => {
    const root = await mkdtemp(join(tmpdir(), "code-contour-analyzer-consistency-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ include: ["src"] }));
    await writeFile(join(root, "src/a.ts"), "import { b } from './b'; export function a() { return b(); }");
    await writeFile(join(root, "src/b.ts"), "import { a } from './a'; export function b() { return aInner(); } export function aInner() { return 1; }");
    const input = { repositoryRoot: root, tsconfigPath: "tsconfig.json" };
    const [symbols, imports, references, calls] = await Promise.all([createSymbolIndex(input), analyzeImportRelations(input), analyzeStaticReferences(input), analyzeCalls(input)]);
    expect(symbols.ok && imports.ok && references.ok && calls.ok).toBe(true);
    if (!symbols.ok || !imports.ok || !references.ok || !calls.ok) return;
    const fileSets = [
      symbols.symbols.map((symbol) => symbol.relativePath),
      imports.relations.map((relation) => relation.evidenceLocation.relativePath),
      references.references.map((reference) => reference.evidenceLocation.relativePath),
      calls.calls.map((call) => call.evidenceLocation.relativePath),
    ].map((paths) => [...new Set(paths)].sort());
    expect(fileSets[0]).toEqual(["src/a.ts", "src/b.ts"]);
    for (const files of fileSets) expect(files).toEqual(fileSets[0]);
  });
});
