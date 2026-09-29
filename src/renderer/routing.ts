import { screenDefinitions, type ScreenId } from "./app-shell.js";

export interface AppRoute {
  screen: ScreenId;
}

export interface RouteDefinition extends AppRoute {
  path: string;
}

export interface RouteContext {
  projectId: string | null;
  repositoryConnected: boolean;
}

export type RouteResolution = {
  route: AppRoute;
  reason?: "PROJECT_REQUIRED" | "REPOSITORY_DISCONNECTED";
  returnPath?: AppRoute;
};

export const appRoutes: readonly RouteDefinition[] = [
  { screen: "project-hub", path: "#/projects" },
  { screen: "repository-setup", path: "#/repository/setup" },
  { screen: "initial-analysis", path: "#/analysis" },
  { screen: "workspace", path: "#/workspace" },
  { screen: "repository-reconnect", path: "#/repository/reconnect" },
  { screen: "global-settings", path: "#/settings" },
  { screen: "project-settings", path: "#/project/settings" },
];

const repositoryBoundScreens = new Set<ScreenId>(["initial-analysis", "workspace", "project-settings"]);

export function parseRoute(hash: string): AppRoute | { screen: "project-hub"; invalidPath: string } {
  const route = appRoutes.find((candidate) => candidate.path === hash || (!hash && candidate.screen === "project-hub"));
  return route ? { screen: route.screen } : { screen: "project-hub", invalidPath: hash };
}

export function routeHash(route: AppRoute): string {
  return appRoutes.find((candidate) => candidate.screen === route.screen)?.path ?? "#/projects";
}

export function resolveRoute(route: AppRoute, context: RouteContext): RouteResolution {
  const definition = screenDefinitions.find((screen) => screen.id === route.screen);
  if (definition?.requiresProject && !context.projectId) return { route: { screen: "project-hub" }, reason: "PROJECT_REQUIRED" };
  if (repositoryBoundScreens.has(route.screen) && !context.repositoryConnected) {
    return { route: { screen: "repository-reconnect" }, reason: "REPOSITORY_DISCONNECTED", returnPath: route };
  }
  return { route };
}

/** Resolves a URL hash through the same guards used by in-app navigation. */
export function resolveHashRoute(hash: string, context: RouteContext): RouteResolution {
  const parsed = parseRoute(hash);
  return resolveRoute({ screen: parsed.screen }, context);
}

export function completeReconnect(returnPath: AppRoute | undefined): AppRoute {
  return returnPath ?? { screen: "project-hub" };
}
