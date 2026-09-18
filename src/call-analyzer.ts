import { realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { loadTypeScriptProject, type RepositoryReaderErrorCode } from "./repository-reader.js";
import { classifyResolution, type ResolutionReason, type ResolutionState } from "./relation-resolution.js";

export interface CallSymbol {
  qualifiedName: string;
  relativePath: string;
  range: { start: number; end: number };
}

export interface CallRelation {
  type: "CALLS";
  targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN";
  resolution: ResolutionState;
  reason?: ResolutionReason;
  inferenceEvidence?: string;
  caller: CallSymbol;
  callee?: CallSymbol;
  evidenceLocation: { relativePath: string; start: number; end: number };
}

export type CallResult =
  | { ok: true; calls: CallRelation[] }
  | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

function compilerPathToAbsolute(root: string, fileName: string): string {
  const absolutePath = isAbsolute(fileName) ? fileName : resolve(root, fileName);
  try { return realpathSync(absolutePath); } catch { return absolutePath; }
}

function pathInRoot(root: string, fileName: string): string | undefined {
  const path = relative(root, compilerPathToAbsolute(root, fileName)).split(sep).join("/");
  return path === ".." || path.startsWith("../") ? undefined : path;
}

export async function analyzeCalls(input: { repositoryRoot: string; tsconfigPath: string }): Promise<CallResult> {
  const project = await loadTypeScriptProject(input);
  if (!project.ok) return project;

  const root = realpathSync(input.repositoryRoot);
  const allowedFiles = new Set(project.files);
  const rootNames = [...project.files, ...project.declarationFiles].map((file) => resolve(root, file));
  const approvedFiles = new Set(rootNames.map((file) => compilerPathToAbsolute(root, file)));
  const nodeModulesRoot = compilerPathToAbsolute(root, resolve(root, "node_modules"));
  const typeScriptLibRoot = dirname(ts.getDefaultLibFilePath(project.compilerOptions));
  const readable = (fileName: string): boolean => {
    const canonicalFile = compilerPathToAbsolute(root, fileName);
    return approvedFiles.has(canonicalFile) || (canonicalFile.endsWith(".d.ts") && (
      canonicalFile.startsWith(`${nodeModulesRoot}${sep}`)
      || canonicalFile.startsWith(`${typeScriptLibRoot}${sep}`)
    ));
  };

  // This host is the security boundary for all Compiler API reads.
  const host = ts.createCompilerHost(project.compilerOptions);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => readable(fileName) && fileExists(fileName);
  host.readFile = (fileName) => readable(fileName) ? readFile(fileName) : undefined;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    readable(fileName) ? getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) : undefined;

  const program = ts.createProgram({ rootNames, options: project.compilerOptions, host });
  const checker = program.getTypeChecker();
  const calls: CallRelation[] = [];
  const identityOf = (declaration: ts.Declaration): CallSymbol | undefined => {
    const relativePath = pathInRoot(root, declaration.getSourceFile().fileName);
    if (!relativePath || !allowedFiles.has(relativePath)) return undefined;
    const name = (declaration as ts.Declaration & { name?: ts.DeclarationName }).name;
    const symbol = name ? checker.getSymbolAtLocation(name) : undefined;
    return {
      qualifiedName: symbol ? checker.getFullyQualifiedName(symbol).replace(/^".*"\./, "") : declaration.getText().slice(0, 40),
      relativePath,
      range: { start: declaration.getStart(), end: declaration.getEnd() },
    };
  };

  for (const source of program.getSourceFiles()) {
    const sourcePath = pathInRoot(root, source.fileName);
    if (!sourcePath || !allowedFiles.has(sourcePath)) continue;
    const fileScope: CallSymbol = { qualifiedName: "<file>", relativePath: sourcePath, range: { start: 0, end: source.getEnd() } };
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        let owner: ts.Declaration | undefined;
        for (let ancestor: ts.Node | undefined = node.parent; ancestor; ancestor = ancestor.parent) {
          if (ts.isFunctionLike(ancestor) || ts.isMethodDeclaration(ancestor)) { owner = ancestor; break; }
        }
        const caller = (owner && identityOf(owner)) ?? fileScope;
        const evidenceLocation = { relativePath: sourcePath, start: node.expression.getStart(source), end: node.expression.getEnd() };

        // Dynamic imports are outside the direct Call Graph scope of PoC-0.
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          calls.push({ type: "CALLS", targetScope: "UNKNOWN", caller, evidenceLocation, ...classifyResolution({ unknownReason: "UNSUPPORTED_SYNTAX" }) });
          ts.forEachChild(node, visit);
          return;
        }
        // Element access (service[action]()) requires runtime data.
        if (ts.isElementAccessExpression(node.expression)) {
          calls.push({ type: "CALLS", targetScope: "UNKNOWN", caller, evidenceLocation, ...classifyResolution({ unknownReason: "DYNAMIC_PROPERTY_ACCESS" }) });
          ts.forEachChild(node, visit);
          return;
        }
        const symbol = checker.getSymbolAtLocation(node.expression);
        const resolved = symbol && (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
        const declaration = resolved?.declarations?.[0];
        const callee = declaration && identityOf(declaration);
        const resolvedSignature = checker.getResolvedSignature(node);
        const declarationPath = declaration && compilerPathToAbsolute(root, declaration.getSourceFile().fileName);
        const externalCallee = declarationPath !== undefined
          && declarationPath.endsWith(".d.ts")
          && readable(declarationPath);
        if (resolved && resolvedSignature?.declaration && (callee || externalCallee)) {
          const interfaceMember = declaration !== undefined && ts.isMethodSignature(declaration) && ts.isInterfaceDeclaration(declaration.parent);
          const classification = interfaceMember
            ? classifyResolution({ inference: { reason: "DECLARED_INTERFACE_MEMBER", evidence: "Interface member declaration" } })
            : classifyResolution({ confirmed: true });
          calls.push({ type: "CALLS", targetScope: callee ? "PROJECT" : "EXTERNAL", caller, callee, evidenceLocation, ...classification });
        } else {
          const importSpecifier = symbol?.declarations?.find(ts.isImportSpecifier);
          const importDeclaration = importSpecifier?.parent.parent.parent;
          const moduleSpecifier = importDeclaration && ts.isImportDeclaration(importDeclaration) && ts.isStringLiteral(importDeclaration.moduleSpecifier)
            ? importDeclaration.moduleSpecifier : undefined;
          const moduleResolution = moduleSpecifier && ts.resolveModuleName(moduleSpecifier.text, source.fileName, project.compilerOptions, host).resolvedModule;
          const modulePath = moduleResolution && compilerPathToAbsolute(root, moduleResolution.resolvedFileName);
          const moduleIsProject = modulePath !== undefined && allowedFiles.has(pathInRoot(root, modulePath) ?? "");
          if (moduleSpecifier && moduleResolution && !moduleIsProject) {
            calls.push({ type: "CALLS", targetScope: "EXTERNAL", caller, evidenceLocation, ...classifyResolution({ unknownReason: "MISSING_EXPORT" }) });
          } else if (symbol?.flags && (symbol.flags & ts.SymbolFlags.Alias)) {
            calls.push({ type: "CALLS", targetScope: "UNKNOWN", caller, evidenceLocation, ...classifyResolution({ unknownReason: "UNRESOLVED_ALIAS" }) });
          } else {
            calls.push({ type: "CALLS", targetScope: "UNKNOWN", caller, evidenceLocation, ...classifyResolution({ unknownReason: "UNRESOLVED_CALL_SIGNATURE" }) });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { ok: true, calls };
}
