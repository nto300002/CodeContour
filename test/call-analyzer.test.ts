import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeCalls } from "../src/call-analyzer.js";

const dirs: string[] = [];
async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "code-contour-calls-"));
  dirs.push(root);
  await Promise.all(Object.entries(files).map(async ([path, text]) => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), text);
  }));
  return root;
}
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe("analyzeCalls", () => {
  it("records direct, imported, instance, static, async and nested project calls", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/domain.ts": "export function imported() { return 1; } export class Service { run() { return imported(); } static create() { return new Service(); } }",
      "src/main.ts": "import { imported, Service } from './domain'; export async function caller() { function nested() { return imported(); } nested(); const service = Service.create(); return await Promise.resolve(service.run()); }",
    });
    const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "CALLS", targetScope: "PROJECT", callee: expect.objectContaining({ qualifiedName: "imported", relativePath: "src/domain.ts" }) }),
      expect.objectContaining({ caller: expect.objectContaining({ qualifiedName: "nested" }), callee: expect.objectContaining({ qualifiedName: "imported" }) }),
      expect.objectContaining({ callee: expect.objectContaining({ qualifiedName: "Service.create" }) }),
      expect.objectContaining({ callee: expect.objectContaining({ qualifiedName: "Service.run" }) }),
    ]));
  });

  it("makes callee navigation ranges and multiple callers exact", async () => {
    const source = "export function target() { return 1; } export function first() { target(); } export function second() { target(); }";
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": source });
    const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const targetCalls = result.calls.filter((call) => call.callee?.qualifiedName === "target");
    expect(targetCalls.map((call) => call.caller.qualifiedName).sort()).toEqual(["first", "second"]);
    for (const call of targetCalls) {
      expect(source.slice(call.callee!.range.start, call.callee!.range.end)).toBe("export function target() { return 1; }");
      expect(source.slice(call.evidenceLocation.start, call.evidenceLocation.end)).toBe("target");
    }
  });

  it("records recursion once without looping and gives top-level calls a file-scope caller", async () => {
    const source = "export function recursive() { recursive(); } recursive();";
    const root = await fixture({ "tsconfig.json": JSON.stringify({ include: ["src"] }), "src/main.ts": source });
    const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const calls = result.calls.filter((call) => call.callee?.qualifiedName === "recursive");
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.caller.qualifiedName).sort()).toEqual(["<file>", "recursive"]);
  });

  it("records an overload call once and navigates to its declared project symbol", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export function overloaded(value: string): string; export function overloaded(value: number): number; export function overloaded(value: string | number) { return value; } export function caller() { return overloaded('x'); }",
    });
    const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const calls = result.calls.filter((call) => call.callee?.qualifiedName === "overloaded");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ caller: { qualifiedName: "caller" }, callee: { relativePath: "src/main.ts" } });
  });

  it("records an optional method call when its callee is statically resolved", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export class Service { run() {} } export function caller(service?: Service) { service?.run(); }",
    });
    const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.calls).toEqual([expect.objectContaining({
      caller: expect.objectContaining({ qualifiedName: "caller" }),
      callee: expect.objectContaining({ qualifiedName: "Service.run", relativePath: "src/main.ts" }),
    })]);
  });

  it("marks declared external calls and excludes computed and unresolved calls", async () => {
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "node_modules/external/index.d.ts": "export declare function external(): void;",
      "src/main.ts": "import { external } from 'external'; const service: Record<string, () => void> = {}; const action = 'run'; declare const callback: unknown; export function caller() { external(); service[action](); callback(); }",
    });
    const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.calls).toEqual([expect.objectContaining({ targetScope: "EXTERNAL", resolution: "RESOLVED", callee: undefined })]);
  });

  it("does not read ignored or root-external implementation calls", async () => {
    const outside = join(tmpdir(), `code-contour-call-outside-${Date.now()}.ts`);
    await writeFile(outside, "export function outsideCall() {}");
    const root = await fixture({
      ".gitignore": "ignored.ts\n",
      "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { OUTSIDE: [outside] } }, include: ["src"] }),
      "src/ignored.ts": "export function ignoredCall() {}",
      "src/main.ts": "import { ignoredCall } from './ignored'; import { outsideCall } from 'OUTSIDE'; export function caller() { ignoredCall(); outsideCall(); }",
    });
    try {
      const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.calls).toEqual([]);
    } finally { await rm(outside, { force: true }); }
  });

  it("does not follow a root-external symlink implementation", async () => {
    const outside = join(tmpdir(), `code-contour-call-linked-${Date.now()}.ts`);
    await writeFile(outside, "export function linkedCall() {}");
    const root = await fixture({
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "import { linkedCall } from './linked'; export function caller() { linkedCall(); }",
    });
    await symlink(outside, join(root, "src/linked.ts"));
    try {
      const result = await analyzeCalls({ repositoryRoot: root, tsconfigPath: "tsconfig.json" });
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.calls).toEqual([]);
    } finally { await rm(outside, { force: true }); }
  });
});
