import type { HubProject } from "./project-hub.js";
import type { InitialAnalysisApi } from "./initial-analysis.js";
import type { RepositorySetupApi } from "./repository-setup.js";

export interface ProjectModelProjection {
  version: 1; projectId: string;
  features: readonly { id: string; name: string; origin: "USER"; confirmation: "CONFIRMED"; lifecycle?: "ACTIVE" | "ARCHIVED" }[];
  processes: readonly { id: string; featureId: string; name: string; order?: number; steps: readonly unknown[] }[];
  dataFlows: readonly { id: string; featureId: string; fromProcessId: string; toProcessId: string; label: string; verification: "UNVERIFIED" | "EVIDENCED"; evidence: readonly { symbolId: string; name: string; qualifiedName: string; relativePath: string; range: { start: number; end: number } }[] }[];
}
export interface ProjectModelApi {
  load(projectId: string): Promise<ProjectModelProjection>;
  listProjects?(): Promise<HubProject[]>;
  listSymbols?(projectId: string): Promise<readonly import("./process-data-flow.js").CanonicalProjectSymbol[]>;
  configureRepository(projectId: string, repositoryRoot: string, tsconfigPath: string): Promise<unknown>;
  createFeature(projectId: string, name: string): Promise<unknown>;
  createProcess(projectId: string, featureId: string, name: string): Promise<unknown>;
  createDataFlow(projectId: string, fromProcessId: string, toProcessId: string, label: string): Promise<unknown>;
  addEvidence(projectId: string, dataFlowId: string, symbolId: string): Promise<unknown>;
  execute(projectId: string, command: ProjectModelCommand): Promise<unknown>;
}
export type ProjectModelCommand =
  | { type: "feature.rename"; featureId: string; name: string } | { type: "feature.archive"; featureId: string }
  | { type: "process.rename"; processId: string; name: string } | { type: "process.delete"; processId: string }
  | { type: "process.move"; processId: string; direction: -1 | 1 }
  | { type: "flow.rename"; dataFlowId: string; label: string }
  | { type: "flow.update-endpoints"; dataFlowId: string; fromProcessId: string; toProcessId: string }
  | { type: "flow.delete"; dataFlowId: string };
const unavailable = async (): Promise<never> => { throw new Error("Project Model is unavailable outside the desktop application."); };
export const unavailableProjectModelApi: ProjectModelApi = { load: unavailable, configureRepository: unavailable, createFeature: unavailable, createProcess: unavailable, createDataFlow: unavailable, addEvidence: unavailable, execute: unavailable };

declare global {
  interface Window { codeContour?: {
    repositorySetup?: RepositorySetupApi;
    initialAnalysis?: InitialAnalysisApi;
    projectModel?: {
      load(projectId: string): Promise<ProjectModelProjection>;
      listProjects(): Promise<HubProject[]>;
      listSymbols(projectId: string): Promise<readonly import("./process-data-flow.js").CanonicalProjectSymbol[]>;
      configureRepository(input: { projectId: string; repositoryRoot: string; tsconfigPath: string }): Promise<unknown>;
      createFeature(input: { projectId: string; name: string }): Promise<unknown>;
      createProcess(input: { projectId: string; featureId: string; name: string; firstStepName: string }): Promise<unknown>;
      createDataFlow(input: { projectId: string; fromProcessId: string; toProcessId: string; label: string }): Promise<unknown>;
      addEvidence(input: { projectId: string; dataFlowId: string; symbolId: string }): Promise<unknown>;
      execute(input: { projectId: string; command: ProjectModelCommand }): Promise<unknown>;
    };
  }; }
}

export function desktopProjectModelApi(): ProjectModelApi | undefined {
  const bridge = window.codeContour?.projectModel;
  if (!bridge) return undefined;
  return {
    load: bridge.load,
    listProjects: bridge.listProjects,
    listSymbols: bridge.listSymbols,
    configureRepository: (projectId, repositoryRoot, tsconfigPath) => bridge.configureRepository({ projectId, repositoryRoot, tsconfigPath }),
    createFeature: (projectId, name) => bridge.createFeature({ projectId, name }),
    createProcess: (projectId, featureId, name) => bridge.createProcess({ projectId, featureId, name, firstStepName: name }),
    createDataFlow: (projectId, fromProcessId, toProcessId, label) => bridge.createDataFlow({ projectId, fromProcessId, toProcessId, label }),
    addEvidence: (projectId, dataFlowId, symbolId) => bridge.addEvidence({ projectId, dataFlowId, symbolId }),
    execute: (projectId, command) => bridge.execute({ projectId, command }),
  };
}
