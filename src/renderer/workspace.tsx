import type { ProjectSelection, WorkspaceView } from "./app-shell.js";

export type WorkspaceSelectionKind = "feature" | "process" | "symbol";

export interface WorkspaceSelection {
  kind: WorkspaceSelectionKind;
  label: string;
}

/** The single Renderer-owned context projected into all Workspace panes. */
export interface WorkspaceContext {
  project: ProjectSelection;
  view: WorkspaceView;
  selection: WorkspaceSelection | null;
}

const viewLabel: Record<WorkspaceView, string> = {
  "feature-map": "Feature Map",
  "process-data-flow": "Process / Data Flow",
  "code-viewer": "Code Viewer",
};

function ContextSummary({ context }: { context: WorkspaceContext }) {
  return <>
    <p>Project: {context.project.name}</p>
    <p>Selection: {context.selection?.label ?? "None"}</p>
  </>;
}

export function WorkspaceNavigation({ context }: { context: WorkspaceContext }) {
  return <section aria-label="Workspace navigation"><ContextSummary context={context} /></section>;
}

export function WorkspaceCanvas({ context, onSelect }: { context: WorkspaceContext; onSelect: (selection: WorkspaceSelection) => void }) {
  return (
    <section aria-label="Workspace canvas">
      <h1>{viewLabel[context.view]}</h1>
      <ContextSummary context={context} />
      <button onClick={() => onSelect({ kind: "feature", label: "Authentication feature" })} type="button">Select Authentication feature</button>
    </section>
  );
}

export function WorkspaceInspector({ context }: { context: WorkspaceContext }) {
  return <section aria-label="Workspace inspector"><ContextSummary context={context} /></section>;
}
