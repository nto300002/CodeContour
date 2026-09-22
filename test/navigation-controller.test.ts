import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CallRelation } from "../src/call-analyzer.js";
import type { UserModel } from "../src/feature-service.js";
import { CodeNavigationController } from "../src/navigation-controller.js";
import type { AnalyzerSymbol } from "../src/symbol-index.js";

const authSource = "export function authenticate() { return \"ok\"; }\n";
const tokenSource = "export function createToken() { return \"token\"; }\n";
const loginSource = "export function login() { return authenticate(); }\n";
const definitionRange = (source: string) => ({ start: 0, end: source.length - 1 });
const authRange = definitionRange(authSource);
const tokenRange = definitionRange(tokenSource);
const loginRange = definitionRange(loginSource);

const model: UserModel = {
  version: 1, projectId: "project", features: [{ id: "feature", name: "Authentication", origin: "USER", confirmation: "CONFIRMED" }, { id: "other-feature", name: "Profile", origin: "USER", confirmation: "CONFIRMED" }],
  processes: [{ id: "process", featureId: "feature", name: "Sign in", origin: "USER", confirmation: "CONFIRMED", steps: [] }, { id: "process-2", featureId: "feature", name: "Create token", origin: "USER", confirmation: "CONFIRMED", steps: [] }],
  processSymbolLinks: [
    { processId: "process", symbolId: "auth", name: "authenticate", kind: "FUNCTION", qualifiedName: "authenticate", relativePath: "src/auth.ts", range: authRange },
    { processId: "process", symbolId: "token", name: "createToken", kind: "FUNCTION", qualifiedName: "createToken", relativePath: "src/token.ts", range: tokenRange },
  ],
  dataFlows: [{ id: "flow", featureId: "feature", fromProcessId: "process", toProcessId: "process-2", label: "token", verification: "EVIDENCED", evidence: [{ processId: "process", symbolId: "token", name: "createToken", kind: "FUNCTION", qualifiedName: "createToken", relativePath: "src/token.ts", range: tokenRange }] }],
};

const symbols: AnalyzerSymbol[] = [
  { id: "auth", name: "authenticate", kind: "FUNCTION", qualifiedName: "authenticate", relativePath: "src/auth.ts", range: authRange, signature: "(): string" },
  { id: "token", name: "createToken", kind: "FUNCTION", qualifiedName: "createToken", relativePath: "src/token.ts", range: tokenRange, signature: "(): string" },
  { id: "caller", name: "login", kind: "FUNCTION", qualifiedName: "login", relativePath: "src/login.ts", range: loginRange, signature: "(): string" },
];

const calls: CallRelation[] = [
  { type: "CALLS", targetScope: "PROJECT", resolution: "RESOLVED", caller: { qualifiedName: "login", relativePath: "src/login.ts", range: loginRange }, callee: { qualifiedName: "authenticate", relativePath: "src/auth.ts", range: authRange }, evidenceLocation: { relativePath: "src/login.ts", start: 27, end: 39 } },
  { type: "CALLS", targetScope: "UNKNOWN", resolution: "UNKNOWN", reason: "DYNAMIC_PROPERTY_ACCESS", caller: { qualifiedName: "authenticate", relativePath: "src/auth.ts", range: authRange }, evidenceLocation: { relativePath: "src/auth.ts", start: 20, end: 31 } },
  { type: "CALLS", targetScope: "EXTERNAL", resolution: "RESOLVED", caller: { qualifiedName: "authenticate", relativePath: "src/auth.ts", range: authRange }, evidenceLocation: { relativePath: "src/auth.ts", start: 20, end: 31 } },
];

describe("CodeNavigationController", () => {
  it("navigates Feature → Process → Symbol → Definition Source and clears invalid lower selections", async () => {
    const root = await fixtureRoot();
    const navigation = new CodeNavigationController({ repositoryRoot: root, model, symbols, calls });
    await navigation.selectFeature("feature");
    await navigation.selectProcess("process");
    const state = await navigation.selectSymbol("auth");
    expect(state.selection).toEqual({ featureId: "feature", processId: "process", symbolId: "auth" });
    expect(state.source).toEqual({ relativePath: "src/auth.ts", range: authRange, text: authSource });
    expect(state.source?.text.slice(state.source.range.start, state.source.range.end)).toBe(authSource.trimEnd());
    expect(state.callers).toEqual([expect.objectContaining({ resolution: "RESOLVED", target: expect.objectContaining({ id: "caller" }) })]);
    expect(state.callees).toEqual(expect.arrayContaining([expect.objectContaining({ resolution: "UNKNOWN", target: undefined, reason: "DYNAMIC_PROPERTY_ACCESS" })]));
    await navigation.selectFeature("other-feature");
    expect(navigation.state.selection).toEqual({ featureId: "other-feature" });
  });

  it("returns from a Definition → Caller navigation without losing the prior context", async () => {
    const root = await fixtureRoot();
    const navigation = new CodeNavigationController({ repositoryRoot: root, model, symbols, calls });
    await navigation.selectFeature("feature"); await navigation.selectProcess("process"); await navigation.selectSymbol("auth");
    const caller = navigation.state.callers[0];
    expect(caller.target?.id).toBe("caller");
    await navigation.openRelation(caller);
    expect(navigation.state.selection).toEqual({ featureId: "feature", symbolId: "caller" });
    await navigation.back();
    expect(navigation.state.selection).toEqual({ featureId: "feature", processId: "process", symbolId: "auth" });
  });

  it("navigates Data Flow evidence to its Project Definition and never offers Source navigation for external or UNKNOWN relations", async () => {
    const root = await fixtureRoot();
    const navigation = new CodeNavigationController({ repositoryRoot: root, model, symbols, calls });
    await navigation.selectFeature("feature");
    const state = await navigation.selectDataFlowEvidence("flow", "token");
    expect(state.selection).toEqual({ featureId: "feature", symbolId: "token" });
    expect(state.source?.relativePath).toBe("src/token.ts");
    await navigation.selectProcess("process");
    await navigation.selectSymbol("auth");
    const unknown = navigation.state.callees.find((item) => item.resolution === "UNKNOWN")!;
    await expect(navigation.openRelation(unknown)).resolves.toEqual(expect.objectContaining({ notice: "SOURCE_NAVIGATION_UNAVAILABLE" }));
    const external = navigation.state.callees.find((item) => item.targetScope === "EXTERNAL")!;
    await expect(navigation.openRelation(external)).resolves.toEqual(expect.objectContaining({ notice: "SOURCE_NAVIGATION_UNAVAILABLE" }));
  });

  it("does not crash when a selected Project Symbol has no readable Source File", async () => {
    const root = await mkdtemp(join(tmpdir(), "code-contour-navigation-"));
    const navigation = new CodeNavigationController({ repositoryRoot: root, model, symbols, calls: [] });
    await navigation.selectFeature("feature"); await navigation.selectProcess("process");
    const state = await navigation.selectSymbol("auth");
    expect(state.source).toBeUndefined();
    expect(state.notice).toBe("SOURCE_UNAVAILABLE");
  });

  it("does not read a Source File outside the Repository Root, including through a symlink", async () => {
    const root = await fixtureRoot();
    const outsideRoot = await mkdtemp(join(tmpdir(), "code-contour-navigation-outside-"));
    const outsideFile = join(outsideRoot, "outside.ts");
    await writeFile(outsideFile, "export function secret() {}\n", "utf8");
    await symlink(outsideFile, join(root, "src", "outside-link.ts"));

    const outside = { ...symbols[0], id: "outside", name: "secret", qualifiedName: "secret", relativePath: "../outside.ts" };
    const symlinked = { ...symbols[0], id: "symlinked", name: "secret", qualifiedName: "secret", relativePath: "src/outside-link.ts" };
    const unsafeModel: UserModel = { ...model, processSymbolLinks: [
      ...model.processSymbolLinks,
      { ...model.processSymbolLinks[0], symbolId: outside.id, name: outside.name, qualifiedName: outside.qualifiedName, relativePath: outside.relativePath },
      { ...model.processSymbolLinks[0], symbolId: symlinked.id, name: symlinked.name, qualifiedName: symlinked.qualifiedName, relativePath: symlinked.relativePath },
    ] };
    const navigation = new CodeNavigationController({ repositoryRoot: root, model: unsafeModel, symbols: [...symbols, outside, symlinked], calls: [] });
    await navigation.selectFeature("feature"); await navigation.selectProcess("process");

    const outsideState = await navigation.selectSymbol(outside.id);
    expect(outsideState.source).toBeUndefined();
    expect(outsideState.notice).toBe("SOURCE_UNAVAILABLE");
    const symlinkState = await navigation.selectSymbol(symlinked.id);
    expect(symlinkState.source).toBeUndefined();
    expect(symlinkState.notice).toBe("SOURCE_UNAVAILABLE");
  });
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "code-contour-navigation-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "auth.ts"), authSource, "utf8");
  await writeFile(join(root, "src", "token.ts"), tokenSource, "utf8");
  await writeFile(join(root, "src", "login.ts"), loginSource, "utf8");
  return root;
}
