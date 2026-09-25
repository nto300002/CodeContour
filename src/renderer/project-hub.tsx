import type { AnalysisStatus } from "./status-states.js";
import type { WorkspaceView } from "./app-shell.js";
import { EmptyState } from "./status-states.js";

export interface SavedWorkspaceSelection {
  view: WorkspaceView;
  featureName?: string;
}

export interface HubProject {
  id: string;
  name: string;
  language: string;
  updatedAt: string;
  analysisStatus: AnalysisStatus;
  connectionStatus: "CONNECTED" | "DISCONNECTED";
  hasActiveSnapshot: boolean;
  savedSelection?: SavedWorkspaceSelection;
}

export interface ProjectHubProps {
  projects: readonly HubProject[];
  onOpen: (project: HubProject) => void;
  onContinue: (project: HubProject) => void;
  onRegister: () => void;
}

const viewLabels: Record<WorkspaceView, string> = {
  "feature-map": "Feature Map",
  "process-data-flow": "Process / Data Flow",
  "code-viewer": "Code Viewer",
};

export function ProjectHub({ projects, onOpen, onContinue, onRegister }: ProjectHubProps) {
  return (
    <section>
      <h1>Project Hub</h1>
      {projects.length === 0 ? (
        <>
          <EmptyState action="Register a local project to begin." description="No local projects have been registered." title="No projects" />
          <button onClick={onRegister} type="button">Register new project</button>
        </>
      ) : (
        <>
          <button onClick={onRegister} type="button">Register new project</button>
          <section aria-label="Registered projects">
            {projects.map((project) => (
              <article aria-label={project.name} key={project.id}>
                <h2>{project.name}</h2>
                <p>Language: {project.language}</p>
                <p>Updated: {project.updatedAt}</p>
                <p>Analysis: {project.analysisStatus}</p>
                <p>Connection: {project.connectionStatus}</p>
                {project.savedSelection && <p>Recent work: {viewLabels[project.savedSelection.view]}{project.savedSelection.featureName ? ` — ${project.savedSelection.featureName}` : ""}</p>}
                <button onClick={() => onOpen(project)} type="button">Open {project.name}</button>
                <button onClick={() => onContinue(project)} type="button">Continue {project.name}</button>
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
