import { readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = process.cwd();
const reportDirectory = resolve(root, "coverage");
const summary = JSON.parse(await readFile(resolve(reportDirectory, "coverage-summary.json"), "utf8"));
const groups = {
  domain: ["src/feature-service.ts", "src/process-service.ts", "src/data-flow-service.ts", "src/main-project-model-service.ts", "src/process-symbol-service.ts", "src/navigation-controller.ts", "src/initial-analysis-run.ts", "src/analysis-batch-controller.ts", "src/analysis-batch-gate.ts"],
  analyzer: ["src/repository-reader.ts", "src/approved-typescript-project.ts", "src/symbol-index.ts", "src/reference-analyzer.ts", "src/relation-analyzer.ts", "src/relation-resolution.ts", "src/call-analyzer.ts", "src/analysis-measurement.ts"],
  persistence: ["src/sqlite-driver.ts", "src/sqlite-schema.ts", "src/sqlite-snapshot-service.ts", "src/sqlite-user-model-store.ts", "src/main-project-model-runtime.ts", "src/main-database-service.ts", "src/analysis-batch-service.ts"],
  mainIpc: ["electron-main.cjs", "electron-runtime-lifecycle.cjs", "initial-analysis-ipc.cjs", "project-model-ipc.cjs", "preload.cjs", "forge.config.cjs"],
  renderer: null,
};

const rows = Object.entries(summary).filter(([key]) => key !== "total").map(([path, value]) => [path.startsWith(root + sep) ? path.slice(root.length + 1) : path, value]);
const report = {};
for (const [name, explicitPaths] of Object.entries(groups)) {
  const selected = rows.filter(([path]) => explicitPaths ? explicitPaths.includes(path) : path.startsWith("src/renderer/"));
  const totals = { statements: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 } };
  for (const [, value] of selected) {
    for (const [metric, source] of [["statements", value.statements], ["branches", value.branches]]) {
      totals[metric].covered += source.covered;
      totals[metric].total += source.total;
    }
  }
  report[name] = {
    files: selected.length,
    ...Object.fromEntries(Object.entries(totals).map(([metric, count]) => [metric, { ...count, pct: count.total ? Math.round(count.covered / count.total * 10000) / 100 : null }])),
  };
}
report.unclassified = rows.map(([path]) => path).filter((path) => !Object.values(groups).some((explicitPaths) => explicitPaths ? explicitPaths.includes(path) : path.startsWith("src/renderer/")));
await writeFile(resolve(reportDirectory, "coverage-by-layer.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.unclassified.length > 0) {
  process.stderr.write("Coverage layer mapping must include every source file.\n");
  process.exitCode = 1;
}
