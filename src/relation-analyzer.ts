import ts from "typescript";
import { openApprovedTypeScriptProject } from "./approved-typescript-project.js";
import type { RepositoryReaderErrorCode } from "./repository-reader.js";
import { classifyResolution, type ResolutionReason, type ResolutionState } from "./relation-resolution.js";

export interface DefinitionLocation { relativePath: string; range: { start: number; end: number }; }
export interface ImportRelation { type: "IMPORTS"; importedName: string; localName: string; targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN"; resolution: ResolutionState; reason?: ResolutionReason; evidenceLocation: { relativePath: string; start: number; end: number }; definition?: DefinitionLocation; }
export type RelationAnalyzerResult = { ok: true; relations: ImportRelation[] } | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

export async function analyzeImportRelations(input: { repositoryRoot: string; tsconfigPath: string }): Promise<RelationAnalyzerResult> {
  const approved = await openApprovedTypeScriptProject(input); if (!approved.ok) return approved;
  const { project, program, host, applicationFiles: allowedFiles, toProjectPath } = approved;
  const checker = program.getTypeChecker(); const relations: ImportRelation[] = [];
  const definitionOf = (symbol: ts.Symbol): DefinitionLocation | undefined => {
    const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const declaration = resolved.declarations?.[0]; if (!declaration) return undefined;
    const relativePath = toProjectPath(declaration.getSourceFile().fileName);
    if (!relativePath || !allowedFiles.has(relativePath)) return undefined;
    return { relativePath, range: { start: declaration.getStart(), end: declaration.getEnd() } };
  };
  for (const source of program.getSourceFiles()) {
    const sourcePath = toProjectPath(source.fileName); if (!sourcePath || !allowedFiles.has(sourcePath)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
        const moduleResolution = ts.resolveModuleName(node.moduleSpecifier.text, source.fileName, project.compilerOptions, host).resolvedModule;
        const resolvedModuleRelativePath = moduleResolution ? toProjectPath(moduleResolution.resolvedFileName) : undefined;
        const add = (name: ts.Identifier, importedName: string) => {
          const symbol = checker.getSymbolAtLocation(name);
          const moduleSymbol = checker.getSymbolAtLocation(node.moduleSpecifier);
          const resolvedSource = resolvedModuleRelativePath && allowedFiles.has(resolvedModuleRelativePath)
            ? program.getSourceFiles().find((candidate) => toProjectPath(candidate.fileName) === resolvedModuleRelativePath)
            : undefined;
          const resolvedModuleSymbol = resolvedSource ? checker.getSymbolAtLocation(resolvedSource) : undefined;
          const exportedSymbol = (moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : resolvedModuleSymbol ? checker.getExportsOfModule(resolvedModuleSymbol) : []).find((candidate) => candidate.name === importedName);
          let sourceDefinition: DefinitionLocation | undefined;
          if (resolvedSource) ts.forEachChild(resolvedSource, (candidate) => {
            if (sourceDefinition) return;
            const declarationName = (candidate as ts.Declaration & { name?: ts.DeclarationName }).name;
            const variable = ts.isVariableStatement(candidate) ? candidate.declarationList.declarations.find((item) => ts.isIdentifier(item.name) && item.name.text === importedName) : undefined;
            if ((declarationName && ts.isIdentifier(declarationName) && declarationName.text === importedName) || variable) sourceDefinition = { relativePath: resolvedModuleRelativePath!, range: { start: (variable ?? candidate).getStart(resolvedSource), end: (variable ?? candidate).getEnd() } };
          });
          const definition = (symbol ? definitionOf(symbol) : undefined) ?? (exportedSymbol ? definitionOf(exportedSymbol) : undefined) ?? sourceDefinition;
          const moduleIsProject = resolvedModuleRelativePath !== undefined && allowedFiles.has(resolvedModuleRelativePath);
          const targetScope = definition ? "PROJECT" : moduleIsProject ? "PROJECT" : moduleResolution ? "EXTERNAL" : "UNKNOWN";
          const externalExportExists = !moduleIsProject && exportedSymbol !== undefined;
          const classification = classifyResolution({
            confirmed: definition !== undefined || externalExportExists,
            unknownReason: moduleResolution ? "MISSING_EXPORT" : "UNRESOLVED_ALIAS",
          });
          relations.push({ type: "IMPORTS", importedName, localName: name.text, targetScope, ...classification, evidenceLocation: { relativePath: sourcePath, start: node.moduleSpecifier.getStart(source), end: node.moduleSpecifier.getEnd() }, definition });
        };
        if (node.importClause.name) add(node.importClause.name, "default");
        const bindings = node.importClause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) add(element.name, element.propertyName?.text ?? element.name.text);
        if (bindings && ts.isNamespaceImport(bindings)) add(bindings.name, "*");
      }
      ts.forEachChild(node, visit);
    }; visit(source);
  }
  return { ok: true, relations };
}
