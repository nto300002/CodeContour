import { useState } from "react";

export type RepositorySetupValidation =
  | { ok: true; language: "TypeScript"; estimatedFileCount: number; tsconfigPath: string }
  | { ok: false; fieldErrors: { root?: string; tsconfig?: string } };

export interface RepositorySetupApi {
  pickRoot(): Promise<string | undefined>;
  pickTsconfig(repositoryRoot: string): Promise<string | undefined>;
  validate(input: { repositoryRoot: string; tsconfigPath: string }): Promise<RepositorySetupValidation>;
}

declare global {
  interface Window { codeContour?: { repositorySetup: RepositorySetupApi }; }
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

const safetyPolicies = [
  "Root外のPath TraversalとSymlinkは拒否します。",
  "node_modulesと.gitは解析対象から除外します。",
  ".gitignoreに一致するPathはIndexとAI Contextへ含めません。",
  "Repositoryはread-onlyで扱い、コードは実行しません。",
];

export function RepositorySetup({ api, onCancel, onStartAnalysis }: RepositorySetupProps) {
  const [repositoryRoot, setRepositoryRoot] = useState("");
  const [tsconfigPath, setTsconfigPath] = useState("");
  const [validation, setValidation] = useState<RepositorySetupValidation>();

  const clearValidation = () => setValidation(undefined);
  const chooseRoot = async () => {
    const selected = await api.pickRoot();
    if (selected) { setRepositoryRoot(selected); clearValidation(); }
  };
  const chooseTsconfig = async () => {
    const selected = await api.pickTsconfig(repositoryRoot);
    if (selected) { setTsconfigPath(selected); clearValidation(); }
  };
  const validate = async () => {
    if (!repositoryRoot || !tsconfigPath) {
      setValidation({ ok: false, fieldErrors: { root: repositoryRoot ? undefined : "Repository Root is required.", tsconfig: tsconfigPath ? undefined : "tsconfig path is required." } });
      return;
    }
    setValidation(await api.validate({ repositoryRoot, tsconfigPath }));
  };
  const ready = validation?.ok === true;

  return (
    <section>
      <h1>Repository Setup</h1>
      <p>Select one local TypeScript repository. Validation is read-only and must succeed before analysis starts.</p>
      <label>Repository Root<input aria-label="Repository Root" onChange={(event) => { setRepositoryRoot(event.target.value); clearValidation(); }} value={repositoryRoot} /></label>
      <button onClick={() => void chooseRoot()} type="button">Choose Repository Root</button>
      {validation && !validation.ok && validation.fieldErrors.root && <p role="alert">{validation.fieldErrors.root}</p>}
      <label>tsconfig path<input aria-label="tsconfig path" onChange={(event) => { setTsconfigPath(event.target.value); clearValidation(); }} value={tsconfigPath} /></label>
      <button disabled={!repositoryRoot} onClick={() => void chooseTsconfig()} type="button">Choose tsconfig</button>
      {validation && !validation.ok && validation.fieldErrors.tsconfig && <p role="alert">{validation.fieldErrors.tsconfig}</p>}
      <button onClick={() => void validate()} type="button">Validate configuration</button>
      {ready && <section aria-label="Validation summary"><p>Language: {validation.language}</p><p>Estimated files: {validation.estimatedFileCount}</p><p>tsconfig: {validation.tsconfigPath}</p></section>}
      <section aria-label="Repository safety policy"><h2>Safety checks</h2><ul>{safetyPolicies.map((policy) => <li key={policy}>{policy}</li>)}</ul></section>
      <button onClick={onCancel} type="button">Cancel setup</button>
      <button disabled={!ready} onClick={() => ready && onStartAnalysis({ repositoryRoot, tsconfigPath, validation })} type="button">Start initial analysis</button>
    </section>
  );
}
