import { describe, expect, it } from "vitest";
import { appRoutes, completeReconnect, parseRoute, resolveHashRoute, resolveRoute, type RouteContext } from "../src/renderer/routing.js";

const selectedProject: RouteContext = { projectId: "project-1", repositoryConnected: true };

describe("app routing", () => {
  it("defines direct routes for all seven Screens but not independent Workspace View routes", () => {
    expect(appRoutes.map((route) => route.screen)).toEqual([
      "project-hub",
      "repository-setup",
      "initial-analysis",
      "workspace",
      "repository-reconnect",
      "global-settings",
      "project-settings",
    ]);
    expect(parseRoute("#/workspace")).toEqual({ screen: "workspace" });
    expect(parseRoute("#/workspace/code-viewer")).toEqual({ screen: "project-hub", invalidPath: "#/workspace/code-viewer" });
  });

  it("falls back without changing context when a project-dependent route has no project", () => {
    const context: RouteContext = { projectId: null, repositoryConnected: false };
    expect(resolveRoute({ screen: "workspace" }, context)).toEqual({ route: { screen: "project-hub" }, reason: "PROJECT_REQUIRED" });
    expect(context).toEqual({ projectId: null, repositoryConnected: false });
    expect(resolveHashRoute("#/workspace", { projectId: null, repositoryConnected: true })).toEqual({ route: { screen: "project-hub" }, reason: "PROJECT_REQUIRED" });
  });

  it("redirects a disconnected repository to recovery and restores the preserved returnPath", () => {
    const disconnected: RouteContext = { projectId: "project-1", repositoryConnected: false };
    const guarded = resolveRoute({ screen: "workspace" }, disconnected);
    expect(guarded).toEqual({ route: { screen: "repository-reconnect" }, reason: "REPOSITORY_DISCONNECTED", returnPath: { screen: "workspace" } });
    expect(disconnected).toEqual({ projectId: "project-1", repositoryConnected: false });
    expect(completeReconnect(guarded.returnPath)).toEqual({ screen: "workspace" });
  });
});
