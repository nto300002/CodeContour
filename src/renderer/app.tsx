import { useState } from "react";
import { AppShell, type ProjectSelection, type ScreenId, type WorkspaceView } from "./app-shell.js";

const sampleProject: ProjectSelection = { id: "sample-project", name: "CodeContour sample" };

export function CodeContourApp() {
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [screen, setScreen] = useState<ScreenId>("project-hub");
  const [view, setView] = useState<WorkspaceView>("feature-map");

  return (
    <AppShell activeScreen={screen} activeView={view} onScreenChange={setScreen} onViewChange={setView} project={project}>
      {screen === "project-hub" && (
        <section>
          <h1>Project Hub</h1>
          <p>Select or create a local project to begin.</p>
          <button onClick={() => setProject(sampleProject)} type="button">Select sample project</button>
        </section>
      )}
      {screen === "workspace" && <section><h1>{view === "feature-map" ? "Feature Map" : view === "process-data-flow" ? "Process / Data Flow" : "Code Viewer"}</h1></section>}
      {screen !== "project-hub" && screen !== "workspace" && <section><h1>{screen}</h1></section>}
    </AppShell>
  );
}
