import { describe, expect, it } from "vitest";
import { MainProjectModelRuntime } from "../src/main-project-model-runtime.js";

describe("MainProjectModelRuntime", () => {
  it("owns the SQLite database and resolves only indexed Project Symbols", async () => {
    const runtime = new MainProjectModelRuntime(":memory:");
    runtime.setCanonicalSymbols("project-a", [{ id: "symbol-a", name: "validate", kind: "FUNCTION", qualifiedName: "validate", relativePath: "src/auth.ts", range: { start: 1, end: 2 }, signature: "" }]);
    expect(runtime.resolveProjectSymbol("project-a", "symbol-a")).toMatchObject({ targetScope: "PROJECT", symbol: { id: "symbol-a" } });
    expect(runtime.resolveProjectSymbol("project-a", "missing")).toBeUndefined();
    expect(await runtime.commands("project-a").createFeature("Authentication")).toMatchObject({ ok: true });
    expect((await runtime.commands("project-a").load()).features).toHaveLength(1);
    runtime.close();
  });
});
