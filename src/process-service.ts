import { randomUUID } from "node:crypto";
import type { Process, SelectedProject, UserModel, UserModelStore } from "./feature-service.js";

export type CreateProcessResult =
  | { ok: true; process: Process }
  | { ok: false; error: { code: "PROJECT_NOT_READY" | "FEATURE_NOT_SELECTED" | "FEATURE_NOT_FOUND" | "PROCESS_NAME_REQUIRED" | "STEP_NAME_REQUIRED" } };

export class ProcessService {
  constructor(
    private readonly store: UserModelStore,
    private readonly project: SelectedProject,
    private readonly createId: () => string = randomUUID,
  ) {}

  async load(): Promise<UserModel> { return this.store.load(); }

  async createProcess(input: { featureId?: string; name: string; firstStepName: string }): Promise<CreateProcessResult> {
    if (!this.project.repositoryLoaded) return { ok: false, error: { code: "PROJECT_NOT_READY" } };
    if (!input.featureId) return { ok: false, error: { code: "FEATURE_NOT_SELECTED" } };
    const name = input.name.trim();
    if (!name) return { ok: false, error: { code: "PROCESS_NAME_REQUIRED" } };
    const firstStepName = input.firstStepName.trim();
    if (!firstStepName) return { ok: false, error: { code: "STEP_NAME_REQUIRED" } };
    const model = await this.store.load();
    if (!model.features.some((feature) => feature.id === input.featureId)) return { ok: false, error: { code: "FEATURE_NOT_FOUND" } };
    const process: Process = {
      id: this.createId(), featureId: input.featureId, name, origin: "USER", confirmation: "CONFIRMED",
      steps: [{ id: this.createId(), name: firstStepName, order: 0 }],
    };
    await this.store.save({ ...model, processes: [...model.processes, process] });
    return { ok: true, process };
  }
}

export function processViewItems(model: UserModel, featureId: string): Array<{ id: string; label: string; steps: string[] }> {
  return model.processes.filter((process) => process.featureId === featureId).map((process) => ({
    id: process.id, label: process.name, steps: [...process.steps].sort((a, b) => a.order - b.order).map((step) => step.name),
  }));
}

export interface ProcessViewState {
  processes: Array<{ id: string; label: string; steps: string[] }>;
  validationError?: Exclude<CreateProcessResult, { ok: true }> ["error"]["code"];
}

export class ProcessViewController {
  private selectedFeatureId: string | undefined;
  constructor(private readonly service: ProcessService) {}
  selectFeature(featureId: string | undefined): void { this.selectedFeatureId = featureId; }
  async submit(name: string, firstStepName: string): Promise<ProcessViewState> {
    const result = await this.service.createProcess({ featureId: this.selectedFeatureId, name, firstStepName });
    const model = await this.service.load();
    const processes = this.selectedFeatureId ? processViewItems(model, this.selectedFeatureId) : [];
    return result.ok ? { processes } : { processes, validationError: result.error.code };
  }
}
