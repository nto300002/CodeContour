import { realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { loadTypeScriptProject, type LoadTypeScriptProjectInput, type RepositoryReaderErrorCode, type RepositoryReaderResult } from "./repository-reader.js";

export type ApprovedTypeScriptProjectResult =
  | { ok: true; root: string; project: Extract<RepositoryReaderResult, { ok: true }>; program: ts.Program; host: ts.CompilerHost; applicationFiles: ReadonlySet<string>; toProjectPath(fileName: string): string | undefined }
  | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

/** The only Compiler API boundary for Analyzer source reads and module resolution. */
export async function openApprovedTypeScriptProject(input: LoadTypeScriptProjectInput): Promise<ApprovedTypeScriptProjectResult> {
  const project = await loadTypeScriptProject(input);
  if (!project.ok) return project;
  const root = realpathSync(input.repositoryRoot);
  const canonical = (fileName: string) => { const absolute = isAbsolute(fileName) ? fileName : resolve(root, fileName); try { return realpathSync(absolute); } catch { return absolute; } };
  const toProjectPath = (fileName: string) => {
    const path = relative(root, canonical(fileName)).split(sep).join("/");
    return path === ".." || path.startsWith("../") ? undefined : path;
  };
  const rootNames = [...project.files, ...project.declarationFiles].map((file) => resolve(root, file));
  const approvedFiles = new Set(rootNames.map(canonical));
  const nodeModules = canonical(resolve(root, "node_modules"));
  const typeScriptLib = dirname(ts.getDefaultLibFilePath(project.compilerOptions));
  const readable = (fileName: string) => {
    const file = canonical(fileName);
    return approvedFiles.has(file) || (file.endsWith(".d.ts") && (file.startsWith(`${nodeModules}${sep}`) || file.startsWith(`${typeScriptLib}${sep}`)));
  };
  const host = ts.createCompilerHost(project.compilerOptions);
  const fileExists = host.fileExists.bind(host); const readFile = host.readFile.bind(host); const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => readable(fileName) && fileExists(fileName);
  host.readFile = (fileName) => readable(fileName) ? readFile(fileName) : undefined;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => readable(fileName) ? getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) : undefined;
  return { ok: true, root, project, program: ts.createProgram({ rootNames, options: project.compilerOptions, host }), host, applicationFiles: new Set(project.files), toProjectPath };
}
