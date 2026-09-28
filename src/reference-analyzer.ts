import ts from "typescript";
import { openApprovedTypeScriptProject } from "./approved-typescript-project.js";
import type { RepositoryReaderErrorCode } from "./repository-reader.js";
import type { ResolutionState } from "./relation-resolution.js";

export interface SymbolIdentity { qualifiedName: string; relativePath: string; range: { start: number; end: number }; }
export interface StaticReference { kind: "VALUE" | "TYPE"; resolution: ResolutionState; from: SymbolIdentity; to: SymbolIdentity; targetName: string; evidenceLocation: { relativePath: string; start: number; end: number }; definition: { relativePath: string; range: { start: number; end: number } }; }
export type StaticReferenceResult = { ok: true; references: StaticReference[] } | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent) || ts.isParameter(parent) || ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node || ts.isImportSpecifier(parent) || ts.isImportClause(parent);
}
function isTypeReference(node: ts.Identifier): boolean { return ts.isTypeReferenceNode(node.parent) || ts.isExpressionWithTypeArguments(node.parent) || ts.isTypeQueryNode(node.parent); }

export async function analyzeStaticReferences(input: { repositoryRoot: string; tsconfigPath: string }): Promise<StaticReferenceResult> {
  const approved = await openApprovedTypeScriptProject(input); if (!approved.ok) return approved;
  const { program, applicationFiles: allowed, toProjectPath } = approved;
  const checker = program.getTypeChecker(); const references: StaticReference[] = [];
  const identityOf = (declaration: ts.Declaration): SymbolIdentity | undefined => {
    const relativePath = toProjectPath(declaration.getSourceFile().fileName); if (!relativePath || !allowed.has(relativePath)) return undefined;
    const name = (declaration as ts.Declaration & { name?: ts.DeclarationName }).name;
    const symbol = name ? checker.getSymbolAtLocation(name) : undefined;
    return { qualifiedName: symbol ? checker.getFullyQualifiedName(symbol).replace(/^".*"\./, "") : declaration.getText().slice(0, 40), relativePath, range: { start: declaration.getStart(), end: declaration.getEnd() } };
  };
  for (const source of program.getSourceFiles()) {
    const sourcePath = toProjectPath(source.fileName); if (!sourcePath || !allowed.has(sourcePath)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && !isDeclarationName(node)) {
        const symbol = checker.getSymbolAtLocation(node); const resolved = symbol && (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
        const declaration = resolved?.declarations?.[0]; const definitionPath = declaration && toProjectPath(declaration.getSourceFile().fileName);
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
