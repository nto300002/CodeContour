import ts from "typescript";
import { openApprovedTypeScriptProject } from "./approved-typescript-project.js";
import type { RepositoryReaderErrorCode } from "./repository-reader.js";
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

export async function analyzeCalls(input: { repositoryRoot: string; tsconfigPath: string }): Promise<CallResult> {
  const approved = await openApprovedTypeScriptProject(input); if (!approved.ok) return approved;
  const { project, program, host, applicationFiles: allowedFiles, toProjectPath } = approved;
  const checker = program.getTypeChecker();
  const calls: CallRelation[] = [];
  const identityOf = (declaration: ts.Declaration): CallSymbol | undefined => {
    const relativePath = toProjectPath(declaration.getSourceFile().fileName);
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
    const sourcePath = toProjectPath(source.fileName);
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
        const declarationPath = declaration && declaration.getSourceFile().fileName;
        const externalCallee = declarationPath !== undefined && declarationPath.endsWith(".d.ts") && !allowedFiles.has(toProjectPath(declarationPath) ?? "");
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
          const modulePath = moduleResolution && toProjectPath(moduleResolution.resolvedFileName);
          const moduleIsProject = modulePath !== undefined && allowedFiles.has(modulePath);
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
