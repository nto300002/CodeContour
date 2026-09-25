import { useEffect, useState } from "react";
import { AppShell, type ProjectSelection, type ScreenId, type WorkspaceView } from "./app-shell.js";
import { ProjectHub, type HubProject } from "./project-hub.js";
import { completeReconnect, resolveHashRoute, resolveRoute, routeHash, type AppRoute } from "./routing.js";
import { AnalysisStatePanel, EmptyState, StatusBadge, type AnalysisStatus, type StatusBadgeValue } from "./status-states.js";

const defaultProjects: readonly HubProject[] = [{
  id: "sample-project",
  name: "CodeContour sample",
  language: "TypeScript",
  updatedAt: "2026-09-25",
  analysisStatus: "READY",
  connectionStatus: "CONNECTED",
  hasActiveSnapshot: true,
  savedSelection: { view: "feature-map" },
}];

export interface CodeContourAppProps {
  initialAnalysisStatus?: AnalysisStatus;
  initialSelectionBadge?: StatusBadgeValue;
  initialProjects?: readonly HubProject[];
}

export function CodeContourApp({ initialAnalysisStatus = "READY", initialSelectionBadge = "UNKNOWN", initialProjects = defaultProjects }: CodeContourAppProps) {
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => resolveHashRoute(window.location.hash, { projectId: null, repositoryConnected: true }).route);
  const [view, setView] = useState<WorkspaceView>("feature-map");
  const [repositoryConnected, setRepositoryConnected] = useState(true);
  const [returnPath, setReturnPath] = useState<AppRoute>();
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(initialAnalysisStatus);
  const [selection, setSelection] = useState<string | null>(null);
  const [selectionBadge] = useState<StatusBadgeValue>(initialSelectionBadge);

  const navigate = (target: AppRoute) => {
    const resolved = resolveRoute(target, { projectId: project?.id ?? null, repositoryConnected });
    setRoute(resolved.route);
    setReturnPath(resolved.returnPath);
    window.location.hash = routeHash(resolved.route);
  };

  const openProject = (hubProject: HubProject, restoreSelection: boolean) => {
    const selectedProject: ProjectSelection = { id: hubProject.id, name: hubProject.name };
    const target: AppRoute = { screen: hubProject.hasActiveSnapshot ? "workspace" : "initial-analysis" };
    const repositoryIsConnected = hubProject.connectionStatus === "CONNECTED";
    const resolved = resolveRoute(target, { projectId: selectedProject.id, repositoryConnected: repositoryIsConnected });
    setProject(selectedProject);
    setRepositoryConnected(repositoryIsConnected);
    setView(restoreSelection ? hubProject.savedSelection?.view ?? "feature-map" : "feature-map");
    setSelection(restoreSelection ? hubProject.savedSelection?.featureName ?? null : null);
    setRoute(resolved.route);
    setReturnPath(resolved.returnPath);
    window.location.hash = routeHash(resolved.route);
  };

  const registerProject = () => {
    navigate({ screen: "repository-setup" });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const resolved = resolveHashRoute(window.location.hash, { projectId: project?.id ?? null, repositoryConnected });
      setRoute(resolved.route);
      // A hashchange to the reconnect screen must not discard the path saved
      // by the disconnect transition; that path is restored after reconnecting.
      if (resolved.returnPath) setReturnPath(resolved.returnPath);
      else if (resolved.route.screen !== "repository-reconnect") setReturnPath(undefined);
      if (window.location.hash !== routeHash(resolved.route)) window.location.hash = routeHash(resolved.route);
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [project, repositoryConnected]);

  const simulateDisconnect = () => {
    setRepositoryConnected(false);
    const resolved = resolveRoute(route, { projectId: project?.id ?? null, repositoryConnected: false });
    setRoute(resolved.route);
    setReturnPath(resolved.returnPath);
    window.location.hash = routeHash(resolved.route);
  };

  const reconnect = () => {
    const restored = completeReconnect(returnPath);
    setRepositoryConnected(true);
    setReturnPath(undefined);
    setRoute(restored);
    window.location.hash = routeHash(restored);
  };

  return (
    <AppShell activeScreen={route.screen} activeView={view} onScreenChange={(screen: ScreenId) => navigate({ screen })} onViewChange={setView} project={project}>
      {route.screen === "project-hub" && (
        <ProjectHub onContinue={(hubProject) => openProject(hubProject, true)} onOpen={(hubProject) => openProject(hubProject, false)} onRegister={registerProject} projects={initialProjects} />
      )}
      {route.screen === "workspace" && (
        <section>
          <h1>{view === "feature-map" ? "Feature Map" : view === "process-data-flow" ? "Process / Data Flow" : "Code Viewer"}</h1>
          <button onClick={() => setSelection("Authentication feature")} type="button">Select Authentication feature</button>
          {selection
            ? <p>{`Selected: ${selection}`}</p>
            : <EmptyState action="Select a feature to inspect its analysis state." description="No feature is selected in this Workspace." title="No feature selected" />}
          <StatusBadge status={selectionBadge} />
          {analysisStatus === "PARTIAL"
            ? <AnalysisStatePanel available={["Symbol index", "Definition navigation"]} status="PARTIAL" unavailable={["Call graph"]} />
            : analysisStatus === "FAILED" || analysisStatus === "CANCELLED"
              ? <AnalysisStatePanel onRetry={() => setAnalysisStatus("ANALYZING")} status={analysisStatus} />
              : <AnalysisStatePanel status={analysisStatus} />}
          <button onClick={simulateDisconnect} type="button">Simulate repository disconnect</button>
        </section>
      )}
      {route.screen === "repository-reconnect" && <section><h1>Repository Reconnect</h1><button onClick={reconnect} type="button">Reconnect repository</button></section>}
      {route.screen !== "project-hub" && route.screen !== "workspace" && route.screen !== "repository-reconnect" && <section><h1>{route.screen}</h1></section>}
    </AppShell>
  );
}
