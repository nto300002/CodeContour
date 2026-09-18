import { resolve, relative, sep } from "node:path";
import ts from "typescript";
import { loadTypeScriptProject, type RepositoryReaderErrorCode } from "./repository-reader.js";

export type SymbolKind = "FUNCTION" | "CLASS" | "METHOD" | "INTERFACE" | "TYPE_ALIAS" | "VARIABLE";
export interface AnalyzerSymbol { id: string; kind: SymbolKind; name: string; qualifiedName: string; relativePath: string; range: { start: number; end: number }; signature: string; }
export type SymbolIndexResult = { ok: true; symbols: AnalyzerSymbol[]; filesWithParseErrors: string[] } | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };
export interface SymbolIndexInput { repositoryRoot: string; tsconfigPath: string; }

function kindOf(node: ts.Node): SymbolKind | undefined {
  if (ts.isFunctionDeclaration(node)) return "FUNCTION";
  if (ts.isClassDeclaration(node)) return "CLASS";
  if (ts.isMethodDeclaration(node)) return "METHOD";
  if (ts.isInterfaceDeclaration(node)) return "INTERFACE";
  if (ts.isTypeAliasDeclaration(node)) return "TYPE_ALIAS";
  if (ts.isVariableDeclaration(node) && node.name.kind === ts.SyntaxKind.Identifier && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) return "VARIABLE";
  return undefined;
}
function nameOf(node: ts.Node): string | undefined {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && !node.name) return undefined;
  const named = node as ts.Declaration & { name?: ts.DeclarationName };
  return named.name && ts.isIdentifier(named.name) ? named.name.text : undefined;
}
function signatureOf(node: ts.Node, checker: ts.TypeChecker): string {
  if (ts.isFunctionLike(node)) { const signature = checker.getSignatureFromDeclaration(node); return signature ? checker.signatureToString(signature, node, ts.TypeFormatFlags.NoTruncation) : node.getText().split("{")[0].trim(); }
  if (ts.isVariableDeclaration(node)) return checker.typeToString(checker.getTypeAtLocation(node), node, ts.TypeFormatFlags.NoTruncation);
  return node.getText().split("{")[0].trim();
}

export async function createSymbolIndex(input: SymbolIndexInput): Promise<SymbolIndexResult> {
  const project = await loadTypeScriptProject(input);
  if (!project.ok) return project;
  const rootNames = project.files.map((file) => resolve(input.repositoryRoot, file));
  const program = ts.createProgram({ rootNames, options: project.compilerOptions });
  const checker = program.getTypeChecker(); const symbols: AnalyzerSymbol[] = []; const filesWithParseErrors: string[] = [];
  for (const sourceFile of program.getSourceFiles()) {
    const absolute = resolve(sourceFile.fileName); const root = resolve(input.repositoryRoot);
    const path = relative(root, absolute).split(sep).join("/");
    if (path.startsWith("../") || path === ".." || path.includes("node_modules/")) continue;
    const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    if (parseDiagnostics.length) { filesWithParseErrors.push(path); continue; }
    const visit = (node: ts.Node, scope: string[]) => {
      const kind = kindOf(node); const name = kind && nameOf(node);
      const nextScope = name && (kind === "CLASS" || kind === "FUNCTION") ? [...scope, name] : scope;
      if (kind && name) { const qualifiedName = [...scope, name].join("."); const start = node.getStart(sourceFile); symbols.push({ id: `${path}:${start}:${kind}`, kind, name, qualifiedName, relativePath: path, range: { start, end: node.getEnd() }, signature: signatureOf(node, checker) }); }
      ts.forEachChild(node, (child) => visit(child, nextScope));
    };
    visit(sourceFile, []);
  }
  return { ok: true, symbols, filesWithParseErrors: [...new Set(filesWithParseErrors)].sort() };
}
