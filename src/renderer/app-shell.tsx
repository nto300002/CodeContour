import type { CSSProperties, ReactNode } from "react";

export type ScreenId =
  | "project-hub"
  | "repository-setup"
  | "initial-analysis"
  | "workspace"
  | "repository-reconnect"
  | "global-settings"
  | "project-settings";

export type WorkspaceView = "feature-map" | "process-data-flow" | "code-viewer";

export interface ProjectSelection {
  id: string;
  name: string;
}

export interface ScreenDefinition {
  id: ScreenId;
  label: string;
  requiresProject: boolean;
}

export const screenDefinitions: readonly ScreenDefinition[] = [
  { id: "project-hub", label: "Project Hub", requiresProject: false },
  { id: "repository-setup", label: "Repository Setup", requiresProject: false },
  { id: "initial-analysis", label: "Initial Analysis", requiresProject: true },
  { id: "workspace", label: "Understanding Workspace", requiresProject: true },
  { id: "repository-reconnect", label: "Repository Reconnect", requiresProject: true },
  { id: "global-settings", label: "Global Settings", requiresProject: false },
  { id: "project-settings", label: "Project Settings", requiresProject: true },
];

const workspaceViews: ReadonlyArray<{ id: WorkspaceView; label: string }> = [
  { id: "feature-map", label: "Feature Map" },
  { id: "process-data-flow", label: "Process / Data Flow" },
  { id: "code-viewer", label: "Code Viewer" },
];

const shellStyle: CSSProperties = { display: "grid", gridTemplateRows: "auto 1fr", height: "100vh", minHeight: 0 };
const navigationStyle: CSSProperties = { display: "flex", gap: "0.5rem", padding: "0.75rem", borderBottom: "1px solid #d1d5db", alignItems: "center", flexWrap: "wrap" };
const contentStyle: CSSProperties = { minHeight: 0 };
const projectHubStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(14rem, 22rem) minmax(0, 1fr)", height: "100%", minHeight: 0 };
const workspaceStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(14rem, 20rem) minmax(0, 1fr) minmax(16rem, 24rem)", height: "100%", minHeight: 0 };
const paneStyle: CSSProperties = { overflow: "auto", minHeight: 0, padding: "1rem", borderRight: "1px solid #e5e7eb" };
const canvasStyle: CSSProperties = { ...paneStyle, borderRight: "1px solid #e5e7eb" };

export function isProjectNavigationEnabled(project: ProjectSelection | null): boolean {
  return project !== null;
}

export interface AppShellProps {
  activeScreen: ScreenId;
  activeView?: WorkspaceView;
  project: ProjectSelection | null;
  children: ReactNode;
}

/**
 * Renderer-only shared layout. Application capabilities are supplied later by
 * a typed preload API; this component never imports Node or Electron APIs.
 */
export function AppShell({ activeScreen, activeView = "feature-map", project, children }: AppShellProps) {
  const hasProject = isProjectNavigationEnabled(project);
  const projectNavigationState = hasProject ? "enabled" : "disabled";

  return (
    <div data-shell={activeScreen} style={shellStyle}>
      <header style={navigationStyle}>
        <strong>CodeContour</strong>
        <span aria-label="active-project">{project?.name ?? "No project selected"}</span>
        <nav aria-label="Screen navigation" data-project-navigation={projectNavigationState}>
          {screenDefinitions.map((screen) => (
            <button
              aria-current={screen.id === activeScreen ? "page" : undefined}
              disabled={screen.requiresProject && !hasProject}
              key={screen.id}
              type="button"
            >
              {screen.label}
            </button>
          ))}
        </nav>
      </header>
      <section style={contentStyle}>
        {activeScreen === "project-hub" && (
          <div data-layout="project-hub-two-pane" style={projectHubStyle}>
            <aside data-pane="project-list" style={paneStyle}>Projects</aside>
            <main data-pane="project-detail" style={canvasStyle}>{children}</main>
          </div>
        )}
        {activeScreen === "workspace" && (
          <div data-layout="workspace-three-pane" style={workspaceStyle}>
            <aside data-pane="navigation" style={paneStyle}>
              <nav aria-label="Workspace view navigation">
                {workspaceViews.map((view) => <button aria-current={view.id === activeView ? "page" : undefined} key={view.id} type="button">{view.label}</button>)}
              </nav>
            </aside>
            <main data-pane="canvas" style={canvasStyle}>{children}</main>
            <aside data-pane="inspector" style={{ ...paneStyle, borderRight: undefined }}>Inspector</aside>
          </div>
        )}
        {activeScreen !== "project-hub" && activeScreen !== "workspace" && <main data-layout="screen-content" style={{ ...canvasStyle, height: "100%" }}>{children}</main>}
      </section>
    </div>
  );
}
