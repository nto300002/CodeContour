import { useRef, useState } from "react";
import type { InitialAnalysisApi } from "./initial-analysis.js";

export type RepositorySetupValidation =
  | { ok: true; language: "TypeScript"; estimatedFileCount: number; tsconfigPath: string }
  | { ok: false; fieldErrors: { root?: string; tsconfig?: string } };

export interface RepositorySetupApi {
  pickRoot(): Promise<string | undefined>;
  pickTsconfig(repositoryRoot: string): Promise<string | undefined>;
  validate(input: { repositoryRoot: string; tsconfigPath: string }): Promise<RepositorySetupValidation>;
}

const unavailableApi: RepositorySetupApi = {
  pickRoot: async () => undefined,
  pickTsconfig: async () => undefined,
  validate: async () => ({ ok: false, fieldErrors: { root: "Repository Setup is unavailable outside the desktop application." } }),
};

export function desktopRepositorySetupApi(): RepositorySetupApi {
  return window.codeContour?.repositorySetup ?? unavailableApi;
}

export interface RepositorySetupProps {
  api: RepositorySetupApi;
  onCancel: () => void;
  onStartAnalysis: (input: { repositoryRoot: string; tsconfigPath: string; validation: Extract<RepositorySetupValidation, { ok: true }> }) => void;
}

type ValidationRequest = {
  input: { repositoryRoot: string; tsconfigPath: string };
  result: RepositorySetupValidation;
};

const safetyPolicies = [
  "Root外のPath TraversalとSymlinkは拒否します。",
  "node_modulesと.gitは解析対象から除外します。",
  ".gitignoreに一致するPathはIndexとAI Contextへ含めません。",
  "Repositoryはread-onlyで扱い、コードは実行しません。",
];

export function RepositorySetup({ api, onCancel, onStartAnalysis }: RepositorySetupProps) {
  const [repositoryRoot, setRepositoryRoot] = useState("");
  const [tsconfigPath, setTsconfigPath] = useState("");
  const [validation, setValidation] = useState<ValidationRequest>();
  const validationRequestId = useRef(0);

  const invalidateValidation = () => { validationRequestId.current += 1; setValidation(undefined); };
  const chooseRoot = async () => {
    const selected = await api.pickRoot();
    if (selected) { setRepositoryRoot(selected); invalidateValidation(); }
  };
  const chooseTsconfig = async () => {
    const selected = await api.pickTsconfig(repositoryRoot);
    if (selected) { setTsconfigPath(selected); invalidateValidation(); }
  };
  const validate = async () => {
    const requestId = validationRequestId.current + 1;
    validationRequestId.current = requestId;
    if (!repositoryRoot || !tsconfigPath) {
      setValidation({ input: { repositoryRoot, tsconfigPath }, result: { ok: false, fieldErrors: { root: repositoryRoot ? undefined : "Repository Root is required.", tsconfig: tsconfigPath ? undefined : "tsconfig path is required." } } });
      return;
    }
    const input = { repositoryRoot, tsconfigPath };
    const result = await api.validate(input);
    if (validationRequestId.current === requestId) setValidation({ input, result });
  };
  const ready = validation?.result.ok === true
    && validation.input.repositoryRoot === repositoryRoot
    && validation.input.tsconfigPath === tsconfigPath;

  return (
    <section>
      <h1>Repository Setup</h1>
      <p>Select one local TypeScript repository. Validation is read-only and must succeed before analysis starts.</p>
      <label>Repository Root<input aria-label="Repository Root" onChange={(event) => { setRepositoryRoot(event.target.value); invalidateValidation(); }} value={repositoryRoot} /></label>
      <button onClick={() => void chooseRoot()} type="button">Choose Repository Root</button>
      {validation && !validation.result.ok && validation.result.fieldErrors.root && <p role="alert">{validation.result.fieldErrors.root}</p>}
      <label>tsconfig path<input aria-label="tsconfig path" onChange={(event) => { setTsconfigPath(event.target.value); invalidateValidation(); }} value={tsconfigPath} /></label>
      <button disabled={!repositoryRoot} onClick={() => void chooseTsconfig()} type="button">Choose tsconfig</button>
      {validation && !validation.result.ok && validation.result.fieldErrors.tsconfig && <p role="alert">{validation.result.fieldErrors.tsconfig}</p>}
      <button onClick={() => void validate()} type="button">Validate configuration</button>
      {ready && validation.result.ok && <section aria-label="Validation summary"><p>Language: {validation.result.language}</p><p>Estimated files: {validation.result.estimatedFileCount}</p><p>tsconfig: {validation.result.tsconfigPath}</p></section>}
      <section aria-label="Repository safety policy"><h2>Safety checks</h2><ul>{safetyPolicies.map((policy) => <li key={policy}>{policy}</li>)}</ul></section>
      <button onClick={onCancel} type="button">Cancel setup</button>
      <button disabled={!ready} onClick={() => ready && validation?.result.ok && onStartAnalysis({ ...validation.input, validation: validation.result })} type="button">Start initial analysis</button>
    </section>
  );
}
