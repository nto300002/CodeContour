import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const reportPath = resolve(root, process.env.CODECONTOUR_EXECUTOR_MEASUREMENT_OUTPUT ?? "docs/adr-001-analyzer-executor-measurements.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const lifecycle = report.utilityProcessLifecycle;

const failures = [
  report.status === "COMPLETE" ? undefined : `status must be COMPLETE (was ${report.status})`,
  report.environment?.electronPreflight?.ok ? undefined : "Electron preflight did not succeed",
  report.candidates?.small?.irEqual ? undefined : "Small IR comparison did not succeed",
  report.candidates?.medium?.irEqual ? undefined : "Medium IR comparison did not succeed",
  lifecycle?.heartbeatWindowStarted ? undefined : "Main heartbeat observation window was not started",
  lifecycle?.heartbeatContinued ? undefined : "Main heartbeat did not continue after crash",
  lifecycle?.ipcResponseCount >= 20 ? undefined : "Fewer than 20 Main IPC responses were observed",
  lifecycle?.ipcP95RoundTripMs < 100 ? undefined : "Main IPC response p95 exceeded 100ms",
  lifecycle?.crashExitCode === 42 ? undefined : "utilityProcess crash exit code was not observed",
  lifecycle?.restartedIr?.files === 10 ? undefined : "utilityProcess refork did not return the expected IR",
  lifecycle?.cancelledDuringAnalysis ? undefined : "Cancel was not observed during analysis",
  lifecycle?.cancelledBatchRejected ? undefined : "Cancelled delayed Batch was not rejected",
  lifecycle?.cancelledBatchSaveCount === 0 ? undefined : "Cancelled delayed Batch was saved",
].filter(Boolean);

if (failures.length > 0) {
  console.error(`Executor measurement gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Executor measurement gate passed: ${reportPath}`);
}
