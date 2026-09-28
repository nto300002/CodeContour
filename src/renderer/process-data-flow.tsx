import { useEffect, useMemo, useState } from "react";
import type { WorkspaceEntitySelection } from "./workspace.js";

export interface FlowProcess {
  id: string;
  featureId: string;
  name: string;
  order: number;
  lifecycle: "ACTIVE" | "TOMBSTONE";
  codeRefCount: number;
  inputs: readonly string[];
  outputs: readonly string[];
}

export interface FlowEvidence { name: string; relativePath?: string; }
export interface FlowData {
  id: string;
  featureId: string;
  fromProcessId: string;
  toProcessId: string;
  label: string;
  verification: "UNVERIFIED" | "EVIDENCED";
  freshness: "CURRENT" | "STALE";
  evidence: readonly FlowEvidence[];
}

export interface ProcessDataFlowState { processes: readonly FlowProcess[]; flows: readonly FlowData[]; }

export function ProcessDataFlowCanvas({ feature, processes, flows, selectedProcessId, selectedFlowId, onSelectProcess, onSelectFlow, onCreateProcess, onMoveProcess, onCreateFlow }: {
  feature?: WorkspaceEntitySelection; processes: readonly FlowProcess[]; flows: readonly FlowData[]; selectedProcessId?: string; selectedFlowId?: string;
  onSelectProcess: (process: FlowProcess) => void; onSelectFlow: (flow: FlowData) => void; onCreateProcess: (name: string) => void; onMoveProcess: (processId: string, direction: -1 | 1) => void; onCreateFlow: (input: { fromProcessId: string; toProcessId: string; label: string }) => void;
}) {
  const [processName, setProcessName] = useState("");
  const [fromProcessId, setFromProcessId] = useState("");
  const [toProcessId, setToProcessId] = useState("");
  const [flowLabel, setFlowLabel] = useState("");
  const ordered = useMemo(() => processes.filter((process) => process.featureId === feature?.id).sort((a, b) => a.order - b.order), [feature?.id, processes]);
  const visibleFlows = useMemo(() => flows.filter((flow) => flow.featureId === feature?.id), [feature?.id, flows]);
  const processNameById = new Map(ordered.map((process) => [process.id, process.name]));
  if (!feature) return <section aria-label="Process / Data Flow canvas"><h1>Process / Data Flow</h1><p role="status">Select a Feature before editing its Flow.</p></section>;
  const canCreateFlow = fromProcessId !== "" && toProcessId !== "" && fromProcessId !== toProcessId && flowLabel.trim() !== "";
  return <section aria-label="Process / Data Flow canvas">
    <h1>Process / Data Flow</h1><p aria-label="Selected Feature">Selected Feature: {feature.label}</p>
    <label>New process name<input aria-label="New process name" onChange={(event) => setProcessName(event.target.value)} value={processName} /></label>
    <button disabled={!processName.trim()} onClick={() => { onCreateProcess(processName); setProcessName(""); }} type="button">Add process</button>
    {ordered.map((process, index) => <article aria-label={`Process: ${process.name}`} data-process-order={process.order} data-selected={process.id === selectedProcessId ? "true" : "false"} key={process.id}>
      <h2>{process.name}</h2><p>Lifecycle: {process.lifecycle}</p><p>Code refs: {process.codeRefCount}</p><p>Input: {process.inputs.join(", ") || "None"}</p><p>Output: {process.outputs.join(", ") || "None"}</p>
      <button onClick={() => onSelectProcess(process)} type="button">Select {process.name} process</button>
      <button disabled={index === 0} onClick={() => onMoveProcess(process.id, -1)} type="button">Move {process.name} up</button>
      <button disabled={index === ordered.length - 1} onClick={() => onMoveProcess(process.id, 1)} type="button">Move {process.name} down</button>
    </article>)}
    <section aria-label="Create data flow"><h2>Data flow</h2>
      <label>From process<select aria-label="From process" onChange={(event) => setFromProcessId(event.target.value)} value={fromProcessId}><option value="">Select process</option>{ordered.map((process) => <option key={process.id} value={process.id}>{process.name}</option>)}</select></label>
      <label>To process<select aria-label="To process" onChange={(event) => setToProcessId(event.target.value)} value={toProcessId}><option value="">Select process</option>{ordered.map((process) => <option key={process.id} value={process.id}>{process.name}</option>)}</select></label>
      <label>Data flow label<input aria-label="Data flow label" onChange={(event) => setFlowLabel(event.target.value)} value={flowLabel} /></label>
      <button disabled={!canCreateFlow} onClick={() => { onCreateFlow({ fromProcessId, toProcessId, label: flowLabel }); setFlowLabel(""); }} type="button">Add data flow</button>
    </section>
    {visibleFlows.map((flow) => <article aria-label={`Data flow: ${flow.label}`} data-selected={flow.id === selectedFlowId ? "true" : "false"} key={flow.id}>
      <h2>{flow.label}</h2><p>From: {processNameById.get(flow.fromProcessId) ?? "Unknown"} · To: {processNameById.get(flow.toProcessId) ?? "Unknown"}</p><p>Verification: {flow.verification}</p><p>Freshness: {flow.freshness}</p>
      <button onClick={() => onSelectFlow(flow)} type="button">Select {flow.label} data flow</button>
    </article>)}
  </section>;
}

export function ProcessDataFlowInspector({ feature, process, flow, processes, onRenameProcess, onDeleteProcess, onAddEvidence }: {
  feature?: WorkspaceEntitySelection; process?: FlowProcess; flow?: FlowData; processes: readonly FlowProcess[]; onRenameProcess: (name: string) => void; onDeleteProcess: () => void; onAddEvidence: (name: string) => void;
}) {
  const [processName, setProcessName] = useState(process?.name ?? "");
  const [evidenceName, setEvidenceName] = useState("");
  useEffect(() => setProcessName(process?.name ?? ""), [process?.id, process?.name]);
  if (!feature) return <section aria-label="Process / Data Flow inspector"><p>No Feature selected.</p></section>;
  return <section aria-label="Process / Data Flow inspector"><p aria-label="Selected Feature">Selected Feature: {feature.label}</p>
    {!process && !flow && <p>No Process or Data Flow selected.</p>}
    {process && <><h2>{process.name}</h2><p>Code refs: {process.codeRefCount}</p><p>Inputs: {process.inputs.join(", ") || "None"}</p><p>Outputs: {process.outputs.join(", ") || "None"}</p>
      <label>Edit process name<input aria-label="Edit process name" onChange={(event) => setProcessName(event.target.value)} value={processName} /></label><button disabled={!processName.trim()} onClick={() => onRenameProcess(processName)} type="button">Save process name</button><button onClick={onDeleteProcess} type="button">Delete process</button></>}
    {flow && <><h2>{flow.label}</h2><p>Verification: {flow.verification}</p><p>Freshness: {flow.freshness}</p>{flow.evidence.map((evidence, index) => <p key={`${evidence.name}-${index}`}>Evidence: {evidence.name}{evidence.relativePath ? ` (${evidence.relativePath})` : ""}</p>)}
      <label>Evidence symbol<input aria-label="Evidence symbol" onChange={(event) => setEvidenceName(event.target.value)} value={evidenceName} /></label><button disabled={!evidenceName.trim()} onClick={() => { onAddEvidence(evidenceName); setEvidenceName(""); }} type="button">Add evidence</button></>}
  </section>;
}
