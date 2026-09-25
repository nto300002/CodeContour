import { useEffect, useState } from "react";
import { AppShell, type ProjectSelection, type ScreenId, type WorkspaceView } from "./app-shell.js";
import { completeReconnect, resolveHashRoute, resolveRoute, routeHash, type AppRoute } from "./routing.js";

const sampleProject: ProjectSelection = { id: "sample-project", name: "CodeContour sample" };

export function CodeContourApp() {
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => resolveHashRoute(window.location.hash, { projectId: null, repositoryConnected: true }).route);
  const [view, setView] = useState<WorkspaceView>("feature-map");
  const [repositoryConnected, setRepositoryConnected] = useState(true);
  const [returnPath, setReturnPath] = useState<AppRoute>();

  const navigate = (target: AppRoute) => {
    const resolved = resolveRoute(target, { projectId: project?.id ?? null, repositoryConnected });
    setRoute(resolved.route);
    setReturnPath(resolved.returnPath);
    window.location.hash = routeHash(resolved.route);
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
        <section>
          <h1>Project Hub</h1>
          <p>Select or create a local project to begin.</p>
          <button onClick={() => setProject(sampleProject)} type="button">Select sample project</button>
        </section>
      )}
      {route.screen === "workspace" && <section><h1>{view === "feature-map" ? "Feature Map" : view === "process-data-flow" ? "Process / Data Flow" : "Code Viewer"}</h1><button onClick={simulateDisconnect} type="button">Simulate repository disconnect</button></section>}
      {route.screen === "repository-reconnect" && <section><h1>Repository Reconnect</h1><button onClick={reconnect} type="button">Reconnect repository</button></section>}
      {route.screen !== "project-hub" && route.screen !== "workspace" && route.screen !== "repository-reconnect" && <section><h1>{route.screen}</h1></section>}
    </AppShell>
  );
}
