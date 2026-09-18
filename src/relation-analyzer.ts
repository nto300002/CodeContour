import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { realpathSync } from "node:fs";
import ts from "typescript";
import { loadTypeScriptProject, type RepositoryReaderErrorCode } from "./repository-reader.js";

export interface DefinitionLocation { relativePath: string; range: { start: number; end: number }; }
export interface ImportRelation { type: "IMPORTS"; importedName: string; localName: string; targetScope: "PROJECT" | "EXTERNAL" | "UNKNOWN"; resolution: "RESOLVED" | "UNKNOWN"; evidenceLocation: { relativePath: string; start: number; end: number }; definition?: DefinitionLocation; }
export type RelationAnalyzerResult = { ok: true; relations: ImportRelation[] } | { ok: false; error: { code: RepositoryReaderErrorCode; message: string } };

function compilerPathToAbsolute(root: string, fileName: string): string {
  const absolutePath = isAbsolute(fileName) ? fileName : resolve(root, fileName);
  try { return realpathSync(absolutePath); } catch { return absolutePath; }
}

function pathInRoot(root: string, fileName: string): string | undefined {
  const path = relative(root, compilerPathToAbsolute(root, fileName)).split(sep).join("/");
  return path === ".." || path.startsWith("../") ? undefined : path;
}

export async function analyzeImportRelations(input: { repositoryRoot: string; tsconfigPath: string }): Promise<RelationAnalyzerResult> {
  const project = await loadTypeScriptProject(input); if (!project.ok) return project;
  const root = realpathSync(input.repositoryRoot); const allowedFiles = new Set(project.files);
  const rootNames = [...project.files, ...project.declarationFiles].map((file) => resolve(root, file));
  const approvedFiles = new Set(rootNames.map((file) => compilerPathToAbsolute(root, file)));
  const nodeModulesRoot = compilerPathToAbsolute(root, resolve(root, "node_modules"));
  const typeScriptLibRoot = dirname(ts.getDefaultLibFilePath(project.compilerOptions));
  const readable = (fileName: string) => {
    const canonicalFile = compilerPathToAbsolute(root, fileName);
    if (approvedFiles.has(canonicalFile)) return true;
    return canonicalFile.endsWith(".d.ts") && (canonicalFile.startsWith(`${nodeModulesRoot}${sep}`) || canonicalFile.startsWith(`${typeScriptLibRoot}${sep}`));
  };
  const host = ts.createCompilerHost(project.compilerOptions);
  const fileExists = host.fileExists.bind(host); const readFile = host.readFile.bind(host); const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => readable(fileName) && fileExists(fileName);
  host.readFile = (fileName) => readable(fileName) ? readFile(fileName) : undefined;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => readable(fileName) ? getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) : undefined;
  const program = ts.createProgram({ rootNames, options: project.compilerOptions, host });
  const checker = program.getTypeChecker(); const relations: ImportRelation[] = [];
  const definitionOf = (symbol: ts.Symbol): DefinitionLocation | undefined => {
    const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const declaration = resolved.declarations?.[0]; if (!declaration) return undefined;
    const relativePath = pathInRoot(root, declaration.getSourceFile().fileName);
    if (!relativePath || !allowedFiles.has(relativePath)) return undefined;
    return { relativePath, range: { start: declaration.getStart(), end: declaration.getEnd() } };
  };
  for (const source of program.getSourceFiles()) {
    const sourcePath = pathInRoot(root, source.fileName); if (!sourcePath || !allowedFiles.has(sourcePath)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
        const moduleResolution = ts.resolveModuleName(node.moduleSpecifier.text, source.fileName, project.compilerOptions, host).resolvedModule;
        const resolvedModulePath = moduleResolution ? compilerPathToAbsolute(root, moduleResolution.resolvedFileName) : undefined;
        const resolvedModuleRelativePath = resolvedModulePath ? pathInRoot(root, resolvedModulePath) : undefined;
        const add = (name: ts.Identifier, importedName: string) => {
          const symbol = checker.getSymbolAtLocation(name);
          const moduleSymbol = checker.getSymbolAtLocation(node.moduleSpecifier);
          const resolvedSource = resolvedModulePath && resolvedModuleRelativePath && allowedFiles.has(resolvedModuleRelativePath)
            ? program.getSourceFiles().find((candidate) => compilerPathToAbsolute(root, candidate.fileName) === resolvedModulePath)
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
          const resolution = definition || externalExportExists ? "RESOLVED" : "UNKNOWN";
          relations.push({ type: "IMPORTS", importedName, localName: name.text, targetScope, resolution, evidenceLocation: { relativePath: sourcePath, start: node.moduleSpecifier.getStart(source), end: node.moduleSpecifier.getEnd() }, definition });
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
