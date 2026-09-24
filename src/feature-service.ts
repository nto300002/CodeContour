import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { loadTypeScriptProject } from "./repository-reader.js";

export interface Feature {
  id: string;
  name: string;
  origin: "USER";
  confirmation: "CONFIRMED";
}

export interface ProcessStep { id: string; name: string; order: number; }
export interface Process {
  id: string;
  featureId: string;
  name: string;
  origin: "USER";
  confirmation: "CONFIRMED";
  steps: ProcessStep[];
}
export interface ProcessSymbolLink {
  processId: string; symbolId: string; name: string; kind: string; qualifiedName: string;
  relativePath: string; range: { start: number; end: number };
}
export interface DataFlow { id: string; featureId: string; fromProcessId: string; toProcessId: string; label: string; verification: "UNVERIFIED" | "EVIDENCED"; evidence: ProcessSymbolLink[]; }

export interface UserModel {
  version: 1;
  projectId: string;
  features: Feature[];
  processes: Process[];
  processSymbolLinks: ProcessSymbolLink[];
  dataFlows: DataFlow[];
}

export interface UserModelStore {
  load(): Promise<UserModel>;
  save(model: UserModel): Promise<void>;
}

export interface SelectedProject {
  id: string;
  repositoryLoaded: boolean;
}

export async function loadSelectedProject(input: {
  id: string;
  repositoryRoot: string;
  tsconfigPath: string;
}): Promise<SelectedProject> {
  const result = await loadTypeScriptProject({ repositoryRoot: input.repositoryRoot, tsconfigPath: input.tsconfigPath });
  return { id: input.id, repositoryLoaded: result.ok };
}

export class UserModelFileStore implements UserModelStore {
  constructor(private readonly filePath: string, private readonly projectId: string) {}

  async load(): Promise<UserModel> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!isUserModel(parsed)) throw new Error("user-model.json has an invalid shape.");
      if (parsed.projectId !== this.projectId) throw new Error("user-model.json belongs to a different project.");
      return { ...parsed, processes: parsed.processes ?? [], processSymbolLinks: parsed.processSymbolLinks ?? [], dataFlows: parsed.dataFlows ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyUserModel(this.projectId);
      throw error;
    }
  }

  async save(model: UserModel): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

export type CreateFeatureResult =
  | { ok: true; feature: Feature }
  | { ok: false; error: { code: "NAME_REQUIRED" | "PROJECT_NOT_READY" } };

export class FeatureService {
  constructor(
    private readonly store: UserModelStore,
    private readonly project: SelectedProject,
    private readonly createId: () => string = randomUUID,
  ) {}

  async load(): Promise<UserModel> { return this.store.load(); }

  async createFeature(name: string): Promise<CreateFeatureResult> {
    if (!this.project.repositoryLoaded) return { ok: false, error: { code: "PROJECT_NOT_READY" } };
    const normalizedName = name.trim();
    if (!normalizedName) return { ok: false, error: { code: "NAME_REQUIRED" } };
    const model = await this.store.load();
    const feature: Feature = { id: this.createId(), name: normalizedName, origin: "USER", confirmation: "CONFIRMED" };
    await this.store.save({ ...model, features: [...model.features, feature] });
    return { ok: true, feature };
  }
}

export interface FeatureViewState {
  features: Array<{ id: string; label: string }>;
  validationError?: "NAME_REQUIRED" | "PROJECT_NOT_READY";
}

// The PoC UI boundary is framework-independent until the React shell exists.
// It exposes the exact state a Feature View renders after a user submits a name.
export class FeatureViewController {
  constructor(private readonly service: FeatureService) {}

  async submit(name: string): Promise<FeatureViewState> {
    const result = await this.service.createFeature(name);
    const features = featureViewItems(await this.service.load());
    return result.ok ? { features } : { features, validationError: result.error.code };
  }
}

export function featureViewItems(model: UserModel): Array<{ id: string; label: string }> {
  return model.features.map((feature) => ({ id: feature.id, label: feature.name }));
}

function emptyUserModel(projectId: string): UserModel { return { version: 1, projectId, features: [], processes: [], processSymbolLinks: [], dataFlows: [] }; }

function isUserModel(value: unknown): value is UserModel {
  if (typeof value !== "object" || value === null) return false;
  const model = value as Partial<UserModel>;
  return model.version === 1 && typeof model.projectId === "string" && Array.isArray(model.features)
    && model.features.every((feature) => typeof feature === "object" && feature !== null
      && typeof (feature as Feature).id === "string" && typeof (feature as Feature).name === "string"
      && (feature as Feature).origin === "USER" && (feature as Feature).confirmation === "CONFIRMED")
    && (model.processes === undefined || Array.isArray(model.processes) && model.processes.every(isProcess))
    && (model.processSymbolLinks === undefined || Array.isArray(model.processSymbolLinks) && model.processSymbolLinks.every(isProcessSymbolLink))
    && (model.dataFlows === undefined || Array.isArray(model.dataFlows) && model.dataFlows.every(isDataFlow));
}
function isDataFlow(value: unknown): value is DataFlow { if (typeof value !== "object" || value === null) return false; const flow = value as Partial<DataFlow>; return typeof flow.id === "string" && typeof flow.featureId === "string" && typeof flow.fromProcessId === "string" && typeof flow.toProcessId === "string" && typeof flow.label === "string" && (flow.verification === "UNVERIFIED" || flow.verification === "EVIDENCED") && Array.isArray(flow.evidence) && flow.evidence.every(isProcessSymbolLink); }
function isProcessSymbolLink(value: unknown): value is ProcessSymbolLink {
  if (typeof value !== "object" || value === null) return false;
  const link = value as Partial<ProcessSymbolLink>;
  return typeof link.processId === "string" && typeof link.symbolId === "string" && typeof link.name === "string"
    && typeof link.kind === "string" && typeof link.qualifiedName === "string" && typeof link.relativePath === "string"
    && typeof link.range?.start === "number" && typeof link.range?.end === "number";
}

function isProcess(value: unknown): value is Process {
  if (typeof value !== "object" || value === null) return false;
  const process = value as Partial<Process>;
  return typeof process.id === "string" && typeof process.featureId === "string" && typeof process.name === "string"
    && process.origin === "USER" && process.confirmation === "CONFIRMED" && Array.isArray(process.steps)
    && process.steps.every((step) => typeof step === "object" && step !== null
      && typeof (step as ProcessStep).id === "string" && typeof (step as ProcessStep).name === "string"
      && typeof (step as ProcessStep).order === "number");
}
