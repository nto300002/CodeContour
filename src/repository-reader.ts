import { realpath, readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import ignore, { type Ignore } from "ignore";
import ts from "typescript";

export type RepositoryReaderErrorCode =
  | "PATH_OUTSIDE_ROOT"
  | "TSCONFIG_NOT_FOUND"
  | "TSCONFIG_PARSE_ERROR"
  | "REPOSITORY_READ_ERROR";

export type SkippedFileReason =
  | "PATH_OUTSIDE_ROOT"
  | "GITIGNORE"
  | "RESERVED_DIRECTORY"
  | "SECURITY_IGNORE"
  | "FILE_UNREADABLE";

export type RepositoryReaderResult =
  | {
      ok: true;
      files: string[];
      compilerOptions: ts.CompilerOptions;
      configFilePath: string;
      skippedFiles: Array<{ path: string; reason: SkippedFileReason }>;
    }
  | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

export interface LoadTypeScriptProjectInput {
  repositoryRoot: string;
  tsconfigPath: string;
}

const applicationFilePattern = /\.tsx?$/i;
const permanentlyIgnoredDirectories = new Set([".git", "node_modules"]);

function isWithinRoot(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !isAbsolute(pathFromRoot));
}

function relativePath(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join("/");
}

function isPermanentlyIgnored(path: string): boolean {
  return path.split("/").some((segment) => permanentlyIgnoredDirectories.has(segment));
}

function isSecurityIgnored(path: string): boolean {
  return /(^|\/)(?:\.env(?:\.|$)|credentials?|secrets?)(?:\/|$)|\.(?:pem|key)(?:\.|$)/i.test(path);
}

async function readGitignore(root: string): Promise<Ignore> {
  try {
    return ignore().add(await readFile(resolve(root, ".gitignore"), "utf8"));
  } catch {
    return ignore();
  }
}

function configError(code: RepositoryReaderErrorCode, message: string): RepositoryReaderResult {
  return { ok: false, error: { code, message } };
}

async function validateExtendsChain(root: string, configPath: string, config: unknown, visited = new Set<string>()): Promise<RepositoryReaderResult | undefined> {
  if (typeof config !== "object" || config === null || !("extends" in config)) return undefined;
  const extendedConfig = (config as { extends?: unknown }).extends;
  if (typeof extendedConfig !== "string") return undefined;

  // Config packages outside the selected repository are intentionally unsupported in PoC-0.
  // This fail-closed rule prevents TypeScript from reading an arbitrary parent directory.
  const unresolvedPath = resolve(dirname(configPath), extname(extendedConfig) ? extendedConfig : `${extendedConfig}.json`);
  if (!isWithinRoot(root, unresolvedPath)) {
    return configError("PATH_OUTSIDE_ROOT", "The tsconfig extends path must be inside the repository root.");
  }

  let resolvedPath: string;
  try {
    resolvedPath = await realpath(unresolvedPath);
  } catch {
    return configError("TSCONFIG_PARSE_ERROR", "The tsconfig extends file cannot be resolved.");
  }
  if (!isWithinRoot(root, resolvedPath)) {
    return configError("PATH_OUTSIDE_ROOT", "The tsconfig extends real path must be inside the repository root.");
  }
  if (visited.has(resolvedPath)) return undefined;
  visited.add(resolvedPath);

  const baseConfig = ts.readConfigFile(resolvedPath, ts.sys.readFile);
  if (baseConfig.error) {
    return configError("TSCONFIG_PARSE_ERROR", ts.flattenDiagnosticMessageText(baseConfig.error.messageText, "\n"));
  }
  return validateExtendsChain(root, resolvedPath, baseConfig.config, visited);
}

export async function loadTypeScriptProject(input: LoadTypeScriptProjectInput): Promise<RepositoryReaderResult> {
  let root: string;
  try {
    root = await realpath(input.repositoryRoot);
  } catch {
    return configError("REPOSITORY_READ_ERROR", "Repository root cannot be resolved.");
  }

  const requestedConfigPath = resolve(root, input.tsconfigPath);
  if (!isWithinRoot(root, requestedConfigPath)) {
    return configError("PATH_OUTSIDE_ROOT", "The tsconfig path must be inside the repository root.");
  }

  let configPath: string;
  try {
    configPath = await realpath(requestedConfigPath);
  } catch {
    return configError("TSCONFIG_NOT_FOUND", "The requested tsconfig file does not exist.");
  }
  if (!isWithinRoot(root, configPath)) {
    return configError("PATH_OUTSIDE_ROOT", "The tsconfig real path must be inside the repository root.");
  }

  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    return configError("TSCONFIG_PARSE_ERROR", ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }

  const extendsError = await validateExtendsChain(root, configPath, config.config, new Set([configPath]));
  if (extendsError) return extendsError;

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  if (parsed.errors.length > 0) {
    return configError("TSCONFIG_PARSE_ERROR", ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, "\n"));
  }

  const gitignoreRules = await readGitignore(root);
  const files: string[] = [];
  const skippedFiles: Array<{ path: string; reason: SkippedFileReason }> = [];
  for (const configuredFile of parsed.fileNames) {
    if (!applicationFilePattern.test(configuredFile)) continue;

    const requestedFile = resolve(configuredFile);
    if (!isWithinRoot(root, requestedFile)) {
      skippedFiles.push({ path: relativePath(root, requestedFile), reason: "PATH_OUTSIDE_ROOT" });
      continue;
    }

    let canonicalFile: string;
    try {
      canonicalFile = await realpath(requestedFile);
    } catch {
      skippedFiles.push({ path: relativePath(root, requestedFile), reason: "FILE_UNREADABLE" });
      continue;
    }
    if (!isWithinRoot(root, canonicalFile)) {
      skippedFiles.push({ path: relativePath(root, requestedFile), reason: "PATH_OUTSIDE_ROOT" });
      continue;
    }

    const relativeFile = relativePath(root, canonicalFile);
    if (isPermanentlyIgnored(relativeFile)) {
      skippedFiles.push({ path: relativeFile, reason: "RESERVED_DIRECTORY" });
      continue;
    }
    if (isSecurityIgnored(relativeFile)) {
      skippedFiles.push({ path: relativeFile, reason: "SECURITY_IGNORE" });
      continue;
    }
    if (gitignoreRules.ignores(relativeFile)) {
      skippedFiles.push({ path: relativeFile, reason: "GITIGNORE" });
      continue;
    }
    files.push(relativeFile);
  }

  return {
    ok: true,
    files: [...new Set(files)].sort(),
    compilerOptions: parsed.options,
    configFilePath: relativePath(root, configPath),
    skippedFiles,
  };
}
