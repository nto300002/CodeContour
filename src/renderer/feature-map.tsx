import { useEffect, useState } from "react";
import { EmptyState } from "./status-states.js";

export interface FeatureMapFeature { id: string; name: string; confirmation: "CANDIDATE" | "CONFIRMED"; lifecycle: "ACTIVE" | "ARCHIVED"; freshness: "CURRENT" | "PARTIALLY_STALE" | "STALE"; processCount: number; codeRefCount: number; explanationCount: number; }
export interface FeatureMapRelation { id: string; fromFeatureId: string; toFeatureId: string; label: string; }

export function FeatureMapCanvas({ features, relations, selectedFeatureId, onSelect, onCreate }: { features: readonly FeatureMapFeature[]; relations: readonly FeatureMapRelation[]; selectedFeatureId?: string; onSelect: (feature: FeatureMapFeature) => void; onCreate: (name: string) => void | Promise<boolean> }) {
  const [name, setName] = useState("");
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const create = async () => { if (await onCreate(name) !== false) setName(""); };
  return <section aria-label="Feature Map canvas">
    <h1>Feature Map</h1>
    {features.length === 0 && <EmptyState action="Create the first Feature to begin mapping the project." description="No Features have been created for this Project." title="No features" />}
    <label>Feature name<input aria-label="Feature name" onChange={(event) => setName(event.target.value)} value={name} /></label>
    <button disabled={!name.trim()} onClick={create} type="button">Create feature</button>
    {features.map((feature) => <article aria-label={`Feature: ${feature.name}`} data-selected={feature.id === selectedFeatureId ? "true" : "false"} key={feature.id}>
      <h2>{feature.name}</h2><p>Confirmation: {feature.confirmation}</p><p>Lifecycle: {feature.lifecycle}</p><p>Freshness: {feature.freshness}</p>
      <p>Processes: {feature.processCount} · Code refs: {feature.codeRefCount} · Explanations: {feature.explanationCount}</p>
      <button onClick={() => onSelect(feature)} type="button">Select {feature.name}</button>
    </article>)}
    {relations.map((relation) => { const from = byId.get(relation.fromFeatureId); const to = byId.get(relation.toFeatureId); if (!from || !to) return null; return <p aria-label={`Feature relation: ${from.name} → ${to.name}`} key={relation.id}>{from.name} → {to.name}: {relation.label}</p>; })}
  </section>;
}

export function FeatureMapInspector({ feature, onEdit, onArchive, onViewFlow, readOnly = false }: { feature?: FeatureMapFeature; onEdit: (name: string) => void; onArchive: () => void; onViewFlow: () => void; readOnly?: boolean }) {
  const [name, setName] = useState(feature?.name ?? "");
  useEffect(() => setName(feature?.name ?? ""), [feature?.id, feature?.name]);
  if (!feature) return <section aria-label="Feature Map inspector"><p>No Feature selected.</p></section>;
  return <section aria-label="Feature Map inspector"><h2>{feature.name}</h2><p>Process count: {feature.processCount}</p><p>Code ref count: {feature.codeRefCount}</p><p>Explanation count: {feature.explanationCount}</p>
    {!readOnly && <><label>Edit feature name<input aria-label="Edit feature name" onChange={(event) => setName(event.target.value)} value={name} /></label><button disabled={!name.trim()} onClick={() => onEdit(name)} type="button">Save feature name</button>
    <button disabled={feature.lifecycle === "ARCHIVED"} onClick={onArchive} type="button">Archive feature</button></>}<button onClick={onViewFlow} type="button">View {feature.name} flow</button>
  </section>;
}
