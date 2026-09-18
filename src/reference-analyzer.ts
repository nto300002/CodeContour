import { realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { loadTypeScriptProject, type RepositoryReaderErrorCode } from "./repository-reader.js";
import type { ResolutionState } from "./relation-resolution.js";

export interface SymbolIdentity { qualifiedName: string; relativePath: string; range: { start: number; end: number }; }
export interface StaticReference { kind: "VALUE" | "TYPE"; resolution: ResolutionState; from: SymbolIdentity; to: SymbolIdentity; targetName: string; evidenceLocation: { relativePath: string; start: number; end: number }; definition: { relativePath: string; range: { start: number; end: number } }; }
export type StaticReferenceResult = { ok: true; references: StaticReference[] } | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

function canonicalPath(root: string, fileName: string): string { const path = resolve(root, fileName); try { return realpathSync(path); } catch { return path; } }
function pathInRoot(root: string, fileName: string): string | undefined { const path = relative(root, canonicalPath(root, fileName)).split(sep).join("/"); return path === ".." || path.startsWith("../") ? undefined : path; }
function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent) || ts.isParameter(parent) || ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node || ts.isImportSpecifier(parent) || ts.isImportClause(parent);
}
function isTypeReference(node: ts.Identifier): boolean { return ts.isTypeReferenceNode(node.parent) || ts.isExpressionWithTypeArguments(node.parent) || ts.isTypeQueryNode(node.parent); }

export async function analyzeStaticReferences(input: { repositoryRoot: string; tsconfigPath: string }): Promise<StaticReferenceResult> {
  const project = await loadTypeScriptProject(input); if (!project.ok) return project;
  const root = realpathSync(input.repositoryRoot); const allowed = new Set(project.files);
  const rootNames = [...project.files, ...project.declarationFiles].map((file) => resolve(root, file));
  const approved = new Set(rootNames.map((file) => canonicalPath(root, file)));
  const nodeModules = canonicalPath(root, resolve(root, "node_modules")); const libDirectory = dirname(ts.getDefaultLibFilePath(project.compilerOptions));
  const readable = (fileName: string) => { const path = canonicalPath(root, fileName); return approved.has(path) || (path.endsWith(".d.ts") && (path.startsWith(`${nodeModules}${sep}`) || path.startsWith(`${libDirectory}${sep}`))); };
  const host = ts.createCompilerHost(project.compilerOptions); const fileExists = host.fileExists.bind(host); const readFile = host.readFile.bind(host); const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => readable(fileName) && fileExists(fileName);
  host.readFile = (fileName) => readable(fileName) ? readFile(fileName) : undefined;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => readable(fileName) ? getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) : undefined;
  const program = ts.createProgram({ rootNames, options: project.compilerOptions, host });
  const checker = program.getTypeChecker(); const references: StaticReference[] = [];
  const identityOf = (declaration: ts.Declaration): SymbolIdentity | undefined => {
    const relativePath = pathInRoot(root, declaration.getSourceFile().fileName); if (!relativePath || !allowed.has(relativePath)) return undefined;
    const name = (declaration as ts.Declaration & { name?: ts.DeclarationName }).name;
    const symbol = name ? checker.getSymbolAtLocation(name) : undefined;
    return { qualifiedName: symbol ? checker.getFullyQualifiedName(symbol).replace(/^".*"\./, "") : declaration.getText().slice(0, 40), relativePath, range: { start: declaration.getStart(), end: declaration.getEnd() } };
  };
  for (const source of program.getSourceFiles()) {
    const sourcePath = pathInRoot(root, source.fileName); if (!sourcePath || !allowed.has(sourcePath)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && !isDeclarationName(node)) {
        const symbol = checker.getSymbolAtLocation(node); const resolved = symbol && (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
        const declaration = resolved?.declarations?.[0]; const definitionPath = declaration && pathInRoot(root, declaration.getSourceFile().fileName);
        let fromDeclaration: ts.Declaration | undefined;
        for (let ancestor: ts.Node | undefined = node.parent; ancestor; ancestor = ancestor.parent) if (ts.isFunctionLike(ancestor) || ts.isMethodDeclaration(ancestor) || ts.isVariableDeclaration(ancestor)) { fromDeclaration = ancestor; break; }
        const from = (fromDeclaration && identityOf(fromDeclaration)) ?? { qualifiedName: "<file>", relativePath: sourcePath, range: { start: 0, end: source.getEnd() } }; const to = declaration && identityOf(declaration);
        if (declaration && definitionPath && allowed.has(definitionPath) && from && to) references.push({ kind: isTypeReference(node) ? "TYPE" : "VALUE", resolution: "RESOLVED", from, to, targetName: resolved!.name, evidenceLocation: { relativePath: sourcePath, start: node.getStart(source), end: node.getEnd() }, definition: { relativePath: definitionPath, range: { start: declaration.getStart(), end: declaration.getEnd() } } });
      }
      ts.forEachChild(node, visit);
    }; visit(source);
  }
  return { ok: true, references };
}
