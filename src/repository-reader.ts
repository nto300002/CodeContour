import { realpath, readFile } from "node:fs/promises";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import ignore from "ignore";
import picomatch from "picomatch";
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
      declarationFiles: string[];
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
const declarationFilePattern = /\.d\.ts$/i;
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

type GitignoreReadResult =
  | { ok: true; contents?: string }
  | { ok: false; error: RepositoryReaderResult };

async function readGitignore(root: string, directory: string): Promise<GitignoreReadResult> {
  const requestedPath = resolve(directory, ".gitignore");
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(requestedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ok: true };
    return { ok: false, error: configError("REPOSITORY_READ_ERROR", ".gitignore cannot be resolved.") };
  }
  if (!isWithinRoot(root, canonicalPath)) {
    return { ok: false, error: configError("PATH_OUTSIDE_ROOT", ".gitignore must be inside the repository root.") };
  }
  try {
    return { ok: true, contents: await readFile(canonicalPath, "utf8") };
  } catch {
    return { ok: false, error: configError("REPOSITORY_READ_ERROR", ".gitignore cannot be read.") };
  }
}

function scopeGitignoreRules(contents: string, directoryFromRoot: string): string[] {
  return contents.split(/\r?\n/).map((line) => {
    if (!directoryFromRoot || !line || line.startsWith("#")) return line;

    const negation = line.startsWith("!") ? "!" : "";
    const pattern = line.slice(negation.length);
    const anchored = pattern.startsWith("/");
    const unanchoredPattern = anchored ? pattern.slice(1) : pattern;
    const withoutTrailingSlash = unanchoredPattern.endsWith("/") ? unanchoredPattern.slice(0, -1) : unanchoredPattern;
    const containsDirectorySeparator = withoutTrailingSlash.includes("/");
    const scopedPattern = anchored || containsDirectorySeparator
      ? `${directoryFromRoot}/${unanchoredPattern}`
      : `${directoryFromRoot}/**/${unanchoredPattern}`;
    return `${negation}${scopedPattern}`;
  });
}

async function isGitIgnored(root: string, filePath: string): Promise<{ ok: true; ignored: boolean } | { ok: false; error: RepositoryReaderResult }> {
  const directories: string[] = [];
  for (let directory = dirname(filePath); ; directory = dirname(directory)) {
    directories.push(directory);
    if (directory === root) break;
  }

  const policy = ignore();
  for (const directory of directories.reverse()) {
    const gitignore = await readGitignore(root, directory);
    if (!gitignore.ok) return gitignore;
    if (gitignore.contents !== undefined) {
      policy.add(scopeGitignoreRules(gitignore.contents, relativePath(root, directory)));
    }
  }
  return { ok: true, ignored: policy.ignores(relativePath(root, filePath)) };
}

function configError(code: RepositoryReaderErrorCode, message: string): RepositoryReaderResult {
  return { ok: false, error: { code, message } };
}

function validateConfigPath(root: string, configPath: string, configuredPath: string): RepositoryReaderResult | undefined {
  const absolutePath = resolve(dirname(configPath), configuredPath);
  if (!isWithinRoot(root, absolutePath)) {
    return configError("PATH_OUTSIDE_ROOT", "Every tsconfig file pattern and project reference must stay inside the repository root.");
  }

  const globIndex = absolutePath.search(/[?*[{]/);
  let existingPrefix = globIndex < 0 ? absolutePath : absolutePath.slice(0, globIndex).replace(/[\\/]$/, "");
  if (!existingPrefix) existingPrefix = dirname(configPath);
  while (!existsSync(existingPrefix)) {
    const parent = dirname(existingPrefix);
    if (parent === existingPrefix) return undefined;
    existingPrefix = parent;
  }
  try {
    if (!isWithinRoot(root, realpathSync(existingPrefix))) {
      return configError("PATH_OUTSIDE_ROOT", "Every tsconfig file pattern and project reference must resolve inside the repository root.");
    }
  } catch {
    return configError("TSCONFIG_PARSE_ERROR", "A tsconfig file pattern or project reference cannot be resolved safely.");
  }
  return undefined;
}

function validateConfigPathOptions(root: string, configPath: string, config: unknown): RepositoryReaderResult | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const value = config as { files?: unknown; include?: unknown; exclude?: unknown; references?: unknown };
  for (const option of [value.files, value.include, value.exclude]) {
    if (!Array.isArray(option)) continue;
    for (const path of option) {
      if (typeof path !== "string") continue;
      const error = validateConfigPath(root, configPath, path);
      if (error) return error;
    }
  }
  if (Array.isArray(value.references)) {
    for (const reference of value.references) {
      if (typeof reference !== "object" || reference === null || !("path" in reference) || typeof reference.path !== "string") continue;
      const error = validateConfigPath(root, configPath, reference.path);
      if (error) return error;
    }
  }
  return undefined;
}

function readConfigDirectory(root: string, path: string, extensions: readonly string[], excludes: readonly string[] | undefined, includes: readonly string[] | undefined, depth: number | undefined, onBoundaryViolation: () => void, onReadFailure: () => void): string[] {
  const requestedDirectory = resolve(path);
  const caseSensitive = ts.sys.useCaseSensitiveFileNames;
  const normalize = (value: string) => value.split(sep).join("/");
  const makeMatcher = (pattern: string) => picomatch(normalize(pattern), { dot: true, nocase: !caseSensitive });
  const globCharacters = /[*?{[]/;
  const includeMatchers = (includes ?? []).map((pattern) => ({ pattern: normalize(pattern), matcher: makeMatcher(pattern) }));
  const excludeMatchers = (excludes ?? []).map((pattern) => ({ pattern: normalize(pattern), matcher: makeMatcher(pattern) }));
  const hasIncludeRestriction = includes !== undefined;
  const matchesDirectoryRule = (candidate: string, rule: { pattern: string; matcher: (path: string) => boolean }) => {
    const normalizedCandidate = normalize(candidate);
    if (rule.matcher(normalizedCandidate)) return true;
    // TypeScript treats a literal directory in include/exclude as a recursive
    // directory selection, while a literal file remains an exact match.
    if (!globCharacters.test(rule.pattern) && !extname(rule.pattern)) {
      return normalizedCandidate.startsWith(`${rule.pattern.replace(/\/$/, "")}/`);
    }
    return false;
  };
  const isExcluded = (candidate: string) => excludeMatchers.some((rule) => matchesDirectoryRule(candidate, rule));
  const isIncluded = (candidate: string) => !hasIncludeRestriction || includeMatchers.some((rule) => matchesDirectoryRule(candidate, rule));
  const couldIncludeDescendant = (directory: string) => !hasIncludeRestriction || includeMatchers.some(({ pattern }) => {
    const fixedPrefix = normalize(pattern).split(/[?*{[]/, 1)[0].replace(/\/$/, "");
    return !fixedPrefix || fixedPrefix === directory || fixedPrefix.startsWith(`${directory}/`) || directory.startsWith(`${fixedPrefix}/`);
  });
  const results: string[] = [];
  const visit = (directory: string, currentDepth: number): void => {
    const canonicalDirectory = realpathSync(directory);
    if (!isWithinRoot(root, directory) || !isWithinRoot(root, canonicalDirectory)) {
      onBoundaryViolation();
      return;
    }
    const logicalDirectory = normalize(relative(requestedDirectory, directory));
    if (logicalDirectory && (isPermanentlyIgnored(logicalDirectory) || isExcluded(logicalDirectory))) return;

    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); }
    catch { onReadFailure(); return; }

    for (const entry of entries) {
      const entryPath = resolve(directory, entry.name);
      const logicalPath = normalize(relative(requestedDirectory, entryPath));
      if (isPermanentlyIgnored(logicalPath) || isExcluded(logicalPath)) continue;
      if (entry.isSymbolicLink()) {
        let canonicalEntry: string;
        try { canonicalEntry = realpathSync(entryPath); }
        catch { continue; }
        let entryStat;
        try { entryStat = statSync(entryPath); }
        catch { continue; }
        if (!isWithinRoot(root, canonicalEntry)) {
          if (entryStat.isDirectory() && couldIncludeDescendant(logicalPath)) onBoundaryViolation();
          else if (entryStat.isFile() && extensions.includes(extname(entry.name)) && isIncluded(logicalPath)) results.push(entryPath);
          continue;
        }
        if (entryStat.isDirectory()) {
          if (depth === undefined || currentDepth < depth) visit(entryPath, currentDepth + 1);
        } else if (entryStat.isFile() && extensions.includes(extname(entry.name)) && isIncluded(logicalPath)) results.push(entryPath);
        continue;
      }
      if (entry.isDirectory()) {
        if (depth === undefined || currentDepth < depth) visit(entryPath, currentDepth + 1);
      } else if (entry.isFile() && extensions.includes(extname(entry.name)) && isIncluded(logicalPath)) {
        results.push(entryPath);
      }
    }
  };

  try { visit(requestedDirectory, 0); }
  catch { onReadFailure(); return []; }
  return results;
}

async function validateExtendsChain(root: string, configPath: string, config: unknown, visited = new Set<string>()): Promise<RepositoryReaderResult | undefined> {
  const pathsError = validateConfigPathOptions(root, configPath, config);
  if (pathsError) return pathsError;
  if (typeof config !== "object" || config === null || !("extends" in config)) return undefined;
  const extendedConfig = (config as { extends?: unknown }).extends;
  const extendsPaths = typeof extendedConfig === "string"
    ? [extendedConfig]
    : Array.isArray(extendedConfig) ? extendedConfig.filter((value): value is string => typeof value === "string") : [];

  for (const extendsPath of extendsPaths) {
    // Config packages outside the selected repository are intentionally unsupported in PoC-0.
    // This fail-closed rule prevents TypeScript from reading an arbitrary parent directory.
    const unresolvedPath = resolve(dirname(configPath), extname(extendsPath) ? extendsPath : `${extendsPath}.json`);
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
    if (visited.has(resolvedPath)) continue;
    visited.add(resolvedPath);

    const baseConfig = ts.readConfigFile(resolvedPath, ts.sys.readFile);
    if (baseConfig.error) {
      return configError("TSCONFIG_PARSE_ERROR", ts.flattenDiagnosticMessageText(baseConfig.error.messageText, "\n"));
    }
    const nestedError = await validateExtendsChain(root, resolvedPath, baseConfig.config, visited);
    if (nestedError) return nestedError;
  }
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

  let configBoundaryViolated = false;
  let configReadFailed = false;
  const configHost: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory: (path, extensions, excludes, includes, depth) => {
      const requestedDirectory = resolve(path);
      if (!isWithinRoot(root, requestedDirectory)) { configBoundaryViolated = true; return []; }
      return readConfigDirectory(
        root,
        requestedDirectory,
        extensions,
        excludes,
        includes,
        depth,
        () => { configBoundaryViolated = true; },
        () => { configReadFailed = true; },
      );
    },
    fileExists: (path) => {
      const requestedFile = resolve(path);
      if (!isWithinRoot(root, requestedFile)) { configBoundaryViolated = true; return false; }
      try {
        if (!isWithinRoot(root, realpathSync(requestedFile))) return false;
        return ts.sys.fileExists(requestedFile);
      }
      catch { return false; }
    },
    readFile: (path) => {
      const requestedFile = resolve(path);
      if (!isWithinRoot(root, requestedFile)) { configBoundaryViolated = true; return undefined; }
      try {
        if (!isWithinRoot(root, realpathSync(requestedFile))) return undefined;
        return ts.sys.readFile(requestedFile);
      }
      catch { return undefined; }
    },
  };
  const parsed = ts.parseJsonConfigFileContent(config.config, configHost, root, undefined, configPath);
  if (configBoundaryViolated) return configError("PATH_OUTSIDE_ROOT", "TypeScript config expansion attempted to access a path outside the repository root.");
  if (configReadFailed) return configError("REPOSITORY_READ_ERROR", "A directory selected by the TypeScript config cannot be read safely.");
  if (parsed.errors.length > 0) {
    return configError("TSCONFIG_PARSE_ERROR", ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, "\n"));
  }

  const files: string[] = [];
  const declarationFiles: string[] = [];
  const skippedFiles: Array<{ path: string; reason: SkippedFileReason }> = [];
  for (const configuredFile of parsed.fileNames) {
    if (!applicationFilePattern.test(configuredFile) && !declarationFilePattern.test(configuredFile)) continue;

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

    const logicalRelativeFile = relativePath(root, requestedFile);
    const canonicalRelativeFile = relativePath(root, canonicalFile);
    if (isPermanentlyIgnored(logicalRelativeFile) || isPermanentlyIgnored(canonicalRelativeFile)) {
      skippedFiles.push({ path: logicalRelativeFile, reason: "RESERVED_DIRECTORY" });
      continue;
    }
    if (isSecurityIgnored(logicalRelativeFile) || isSecurityIgnored(canonicalRelativeFile)) {
      skippedFiles.push({ path: logicalRelativeFile, reason: "SECURITY_IGNORE" });
      continue;
    }
    const gitignore = await isGitIgnored(root, requestedFile);
    if (!gitignore.ok) return gitignore.error;
    if (gitignore.ignored) {
      skippedFiles.push({ path: logicalRelativeFile, reason: "GITIGNORE" });
      continue;
    }
    if (declarationFilePattern.test(canonicalRelativeFile)) declarationFiles.push(canonicalRelativeFile);
    else files.push(canonicalRelativeFile);
  }

  return {
    ok: true,
    files: [...new Set(files)].sort(),
    declarationFiles: [...new Set(declarationFiles)].sort(),
    compilerOptions: parsed.options,
    configFilePath: relativePath(root, configPath),
    skippedFiles,
  };
}
