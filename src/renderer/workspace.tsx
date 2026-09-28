import type { ProjectSelection, WorkspaceView } from "./app-shell.js";

export interface WorkspaceEntitySelection {
  id: string;
  label: string;
}

/** Hierarchical selection identity; later persistence owns its invariants. */
export interface WorkspaceSelection {
  feature?: WorkspaceEntitySelection;
  process?: WorkspaceEntitySelection;
  symbol?: WorkspaceEntitySelection;
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
    <p>Feature: {context.selection?.feature?.label ?? "None"}</p>
    <p>Process: {context.selection?.process?.label ?? "None"}</p>
    <p>Symbol: {context.selection?.symbol?.label ?? "None"}</p>
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
      <button onClick={() => onSelect({ feature: { id: "feature:authentication", label: "Authentication feature" } })} type="button">Select Authentication feature</button>
      <button onClick={() => onSelect({ feature: { id: "feature:authentication", label: "Authentication feature" }, process: { id: "process:login", label: "Login process" } })} type="button">Select Login process</button>
      <button onClick={() => onSelect({ feature: { id: "feature:authentication", label: "Authentication feature" }, process: { id: "process:login", label: "Login process" }, symbol: { id: "symbol:validate-token", label: "validateToken" } })} type="button">Select validateToken symbol</button>
    </section>
  );
}

export function WorkspaceInspector({ context }: { context: WorkspaceContext }) {
  return <section aria-label="Workspace inspector"><ContextSummary context={context} /></section>;
}
