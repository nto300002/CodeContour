import { useEffect, useRef, useState } from "react";
import { AppShell, type ProjectSelection, type ScreenId, type WorkspaceView } from "./app-shell.js";
import { ProjectHub, type HubProject } from "./project-hub.js";
import { desktopInitialAnalysisApi, InitialAnalysis, type InitialAnalysisApi } from "./initial-analysis.js";
import { desktopRepositorySetupApi, RepositorySetup, type RepositorySetupApi } from "./repository-setup.js";
import { completeReconnect, resolveHashRoute, resolveRoute, routeHash, type AppRoute } from "./routing.js";
import { AnalysisStatePanel, EmptyState, StatusBadge, type AnalysisStatus, type StatusBadgeValue } from "./status-states.js";
import { WorkspaceCanvas, WorkspaceInspector, WorkspaceNavigation, type WorkspaceSelection } from "./workspace.js";
import { FeatureMapCanvas, FeatureMapInspector, type FeatureMapFeature, type FeatureMapRelation } from "./feature-map.js";

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
  repositorySetupApi?: RepositorySetupApi;
  initialAnalysisApi?: InitialAnalysisApi;
  initialFeatureMapFeatures?: readonly FeatureMapFeature[];
  initialFeatureMapRelations?: readonly FeatureMapRelation[];
  initialFeatureMapFeaturesByProject?: Readonly<Record<string, readonly FeatureMapFeature[]>>;
  initialFeatureMapRelationsByProject?: Readonly<Record<string, readonly FeatureMapRelation[]>>;
}

const defaultFeatureMap: readonly FeatureMapFeature[] = [{ id: "feature:authentication", name: "Authentication", confirmation: "CONFIRMED", lifecycle: "ACTIVE", freshness: "CURRENT", processCount: 1, codeRefCount: 2, explanationCount: 0 }];
export function CodeContourApp({ initialAnalysisStatus = "READY", initialSelectionBadge = "UNKNOWN", initialProjects = defaultProjects, repositorySetupApi = desktopRepositorySetupApi(), initialAnalysisApi = desktopInitialAnalysisApi(), initialFeatureMapFeatures = defaultFeatureMap, initialFeatureMapRelations = [], initialFeatureMapFeaturesByProject = {}, initialFeatureMapRelationsByProject = {} }: CodeContourAppProps) {
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => resolveHashRoute(window.location.hash, { projectId: null, repositoryConnected: true }).route);
  const [view, setView] = useState<WorkspaceView>("feature-map");
  const [repositoryConnected, setRepositoryConnected] = useState(true);
  const [returnPath, setReturnPath] = useState<AppRoute>();
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(initialAnalysisStatus);
  const [analysisPhase, setAnalysisPhase] = useState("Waiting to start");
  const [analysisRun, setAnalysisRun] = useState<{ id: string; projectId: string }>();
  const analysisStartRequestId = useRef(0);
  const [selection, setSelection] = useState<WorkspaceSelection | null>(null);
  const [selectionBadge] = useState<StatusBadgeValue>(initialSelectionBadge);
  const [featureMapFeaturesByProject, setFeatureMapFeaturesByProject] = useState<Readonly<Record<string, readonly FeatureMapFeature[]>>>(() => ({ "sample-project": initialFeatureMapFeatures, ...initialFeatureMapFeaturesByProject }));
  const featureMapRelationsByProject: Readonly<Record<string, readonly FeatureMapRelation[]>> = { "sample-project": initialFeatureMapRelations, ...initialFeatureMapRelationsByProject };
  const featureNumber = useRef(0);

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
    // A background Run remains Main-owned, but must never control another Project's screen.
    ++analysisStartRequestId.current;
    setAnalysisRun(undefined);
    if (!hubProject.hasActiveSnapshot) {
      setAnalysisStatus(hubProject.analysisStatus);
      setAnalysisPhase(hubProject.analysisStatus === "PENDING" ? "Waiting to start" : "Analysis state restored");
    }
    setView(restoreSelection ? hubProject.savedSelection?.view ?? "feature-map" : "feature-map");
    setSelection(restoreSelection && hubProject.savedSelection?.featureId && hubProject.savedSelection.featureName
      ? { feature: { id: hubProject.savedSelection.featureId, label: hubProject.savedSelection.featureName } }
      : null);
    setRoute(resolved.route);
    setReturnPath(resolved.returnPath);
    window.location.hash = routeHash(resolved.route);
  };

  const registerProject = () => {
    navigate({ screen: "repository-setup" });
  };

  const beginInitialAnalysis = (projectId: string) => {
    const requestId = ++analysisStartRequestId.current;
    setAnalysisStatus("PENDING");
    setAnalysisPhase("Starting analysis");
    setAnalysisRun(undefined);
    void initialAnalysisApi.start({ projectId }).then((run) => {
      if (requestId !== analysisStartRequestId.current) return;
      setAnalysisRun({ id: run.runId, projectId });
      setAnalysisStatus(run.status);
      setAnalysisPhase(run.phase);
    }).catch(() => {
      if (requestId !== analysisStartRequestId.current) return;
      setAnalysisStatus("FAILED");
      setAnalysisPhase("Unable to start analysis");
    });
  };

  const startInitialAnalysis = ({ repositoryRoot }: { repositoryRoot: string }) => {
    const name = repositoryRoot.split("/").filter(Boolean).at(-1) ?? "Local repository";
    const selectedProject = { id: `setup:${repositoryRoot}`, name };
    const resolved = resolveRoute({ screen: "initial-analysis" }, { projectId: selectedProject.id, repositoryConnected: true });
    setProject(selectedProject);
    setRepositoryConnected(true);
    setView("feature-map");
    setSelection(null);
    setRoute(resolved.route);
    setReturnPath(resolved.returnPath);
    window.location.hash = routeHash(resolved.route);
    beginInitialAnalysis(selectedProject.id);
  };

  const cancelInitialAnalysis = () => {
    if (!analysisRun || analysisRun.projectId !== project?.id) return;
    const requestId = analysisStartRequestId.current;
    void initialAnalysisApi.cancel({ runId: analysisRun.id, projectId: analysisRun.projectId }).then((result) => {
      if (requestId !== analysisStartRequestId.current) return;
      setAnalysisStatus(result.status);
      setAnalysisPhase(result.phase);
    });
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

  const workspaceContext = project ? { project, view, selection } : undefined;
  const featureMapFeatures = project ? featureMapFeaturesByProject[project.id] ?? [] : [];
  const featureMapRelations = project ? featureMapRelationsByProject[project.id] ?? [] : [];
  const selectedFeature = selection?.feature ? featureMapFeatures.find((feature) => feature.id === selection.feature!.id) : undefined;
  const selectFeature = (feature: FeatureMapFeature) => setSelection({ feature: { id: feature.id, label: feature.name } });
  const createFeature = (name: string) => { const trimmed = name.trim(); if (!trimmed || !project) return; const feature: FeatureMapFeature = { id: `feature:manual-${++featureNumber.current}`, name: trimmed, confirmation: "CONFIRMED", lifecycle: "ACTIVE", freshness: "CURRENT", processCount: 0, codeRefCount: 0, explanationCount: 0 }; const projectId = project.id; setFeatureMapFeaturesByProject((items) => ({ ...items, [projectId]: [...(items[projectId] ?? []), feature] })); selectFeature(feature); };
  const updateSelectedFeature = (update: (feature: FeatureMapFeature) => FeatureMapFeature) => { if (!selectedFeature || !project) return; const next = update(selectedFeature); const projectId = project.id; setFeatureMapFeaturesByProject((items) => ({ ...items, [projectId]: (items[projectId] ?? []).map((feature) => feature.id === next.id ? next : feature) })); selectFeature(next); };

  return (
    <AppShell
      activeScreen={route.screen}
      activeView={view}
      onScreenChange={(screen: ScreenId) => navigate({ screen })}
      onViewChange={setView}
      project={project}
      workspaceInspector={route.screen === "workspace" && view === "feature-map" ? <FeatureMapInspector feature={selectedFeature} onArchive={() => updateSelectedFeature((feature) => ({ ...feature, lifecycle: "ARCHIVED" }))} onEdit={(name) => updateSelectedFeature((feature) => ({ ...feature, name: name.trim() }))} onViewFlow={() => setView("process-data-flow")} /> : route.screen === "workspace" && workspaceContext ? <WorkspaceInspector context={workspaceContext} /> : undefined}
      workspaceNavigation={route.screen === "workspace" && workspaceContext ? <WorkspaceNavigation context={workspaceContext} /> : undefined}
    >
      {route.screen === "project-hub" && (
        <ProjectHub onContinue={(hubProject) => openProject(hubProject, true)} onOpen={(hubProject) => openProject(hubProject, false)} onRegister={registerProject} projects={initialProjects} />
      )}
      {route.screen === "repository-setup" && <RepositorySetup api={repositorySetupApi} onCancel={() => navigate({ screen: "project-hub" })} onStartAnalysis={startInitialAnalysis} />}
      {route.screen === "initial-analysis" && <InitialAnalysis
        onBackground={() => navigate({ screen: "project-hub" })}
        onCancel={cancelInitialAnalysis}
        onOpenWorkspace={() => navigate({ screen: "workspace" })}
        canCancel={analysisRun?.projectId === project?.id}
        onRetry={() => { if (project) beginInitialAnalysis(project.id); }}
        run={{ status: analysisStatus, phase: analysisPhase }}
      />}
      {route.screen === "workspace" && (
        <section>
          {view === "feature-map" ? <FeatureMapCanvas features={featureMapFeatures} onCreate={createFeature} onSelect={selectFeature} relations={featureMapRelations} selectedFeatureId={selection?.feature?.id} /> : workspaceContext && <WorkspaceCanvas context={workspaceContext} onSelect={setSelection} />}
          {selection
            ? <p>{`Selected: ${selection.symbol?.label ?? selection.process?.label ?? selection.feature?.label ?? "None"}`}</p>
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
