import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = process.env.CODECONTOUR_EXECUTOR_MEASUREMENT_OUTPUT ?? "docs/adr-001-analyzer-executor-measurements.json";
const electron = resolve(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const worker = resolve(root, "test/fixtures/executor-spike-worker.cjs");
const utility = resolve(root, "test/fixtures/executor-spike-utility-main.cjs");
const lifecycle = resolve(root, "test/fixtures/executor-spike-utility-lifecycle-main.cjs");

const fixtures = [{ name: "small", files: 10 }, { name: "medium", files: 100 }].map(({ name, files }) => ({ name, input: { files: Array.from({ length: files }, (_, file) => Array.from({ length: 120 }, (_, line) => `export function f${file}_${line}(){return ${line};}`).join("\n")) } }));
const report = {
  generatedAt: new Date().toISOString(),
  status: "RUNNING",
  environment: { platform: platform(), release: release(), arch: arch(), node: process.version, electronBinary: electron },
  candidates: {},
};
try {
const electronPreflight = await run("ELECTRON_RUNTIME_PREFLIGHT", electron, ["--version"], true, false);
report.environment.electronPreflight = electronPreflight;
if (!electronPreflight.ok) {
  report.failure = { code: "UTILITY_PROCESS_RUNTIME_UNAVAILABLE", electronPreflight };
  await saveReport(report);
  throw new Error("Electron runtime preflight failed");
}
for (const fixture of fixtures) {
  const input = JSON.stringify(fixture.input);
  const [workerResult, utilityResult] = await Promise.all([
    run("WORKER_THREAD", process.env.CODECONTOUR_NODE_BINARY ?? "node", [worker, input]),
    run("UTILITY_PROCESS", electron, [utility, input]),
  ]);
  if (!workerResult.ok || !utilityResult.ok) {
    report.failure = { fixture: fixture.name, workerThread: workerResult, utilityProcess: utilityResult };
    await saveReport(report);
    throw new Error(`executor measurement failed; see ${output}`);
  }
  const irEqual = JSON.stringify(workerResult.result.ir) === JSON.stringify(utilityResult.result.ir);
  report.candidates[fixture.name] = { workerThread: workerResult, utilityProcess: utilityResult, irEqual };
  if (!irEqual) throw new Error(`${fixture.name}: IR mismatch`);
}
const node = process.env.CODECONTOUR_NODE_BINARY ?? "node";
const crash = await run("WORKER_THREAD_CRASH", node, [worker, JSON.stringify({ files: [], crash: true })], false);
const restarted = await run("WORKER_THREAD_RESTART", node, [worker, JSON.stringify(fixtures[0].input)]);
report.crashIsolation = { workerExitCode: crash.exitCode, parentContinued: restarted.result.ir.files === 10, restartSucceeded: true };
const utilityCrash = await run("UTILITY_PROCESS_CRASH", electron, [utility, JSON.stringify({ files: [], crash: true })], false);
const utilityRestarted = await run("UTILITY_PROCESS_RESTART", electron, [utility, JSON.stringify(fixtures[0].input)]);
report.utilityProcessCrashIsolation = { utilityExitCode: utilityCrash.exitCode, parentContinued: utilityRestarted.result.ir.files === 10, restartSucceeded: true };
const cancelInput = JSON.stringify({ files: fixtures[0].input.files, delayMs: 200, cancelAfterMs: 10 });
const [workerCancel, utilityCancel] = await Promise.all([
  run("WORKER_THREAD_CANCEL", node, [worker, cancelInput]),
  run("UTILITY_PROCESS_CANCEL", electron, [utility, cancelInput]),
]);
report.cancellation = { workerThread: workerCancel.result.type, utilityProcess: utilityCancel.result.type, scope: "pre-analysis acknowledgement only" };
if (workerCancel.result.type !== "CANCELLED" || utilityCancel.result.type !== "CANCELLED") throw new Error("Cancel was not acknowledged");
const lifecycleResult = await run("UTILITY_PROCESS_LIFECYCLE", electron, [lifecycle, JSON.stringify(fixtures[0].input)]);
if (!lifecycleResult.ok) { report.failure = { lifecycle: lifecycleResult }; await saveReport(report); throw new Error(`utilityProcess lifecycle failed; see ${output}`); }
report.utilityProcessLifecycle = lifecycleResult.result;
if (!lifecycleResult.result) { report.failure = { lifecycle: lifecycleResult }; await saveReport(report); throw new Error(`utilityProcess lifecycle produced no summary; see ${output}`); }
if (lifecycleResult.result.type !== "LIFECYCLE" || lifecycleResult.result.crashExitCode !== 42 || !lifecycleResult.result.heartbeatWindowStarted || !lifecycleResult.result.heartbeatContinued || lifecycleResult.result.ipcResponseCount < 20 || lifecycleResult.result.ipcP95RoundTripMs === null || lifecycleResult.result.ipcP95RoundTripMs >= 100 || !lifecycleResult.result.cancelled || !lifecycleResult.result.cancelledDuringAnalysis || !lifecycleResult.result.cancelledBatchRejected || lifecycleResult.result.cancelledBatchSaveCount !== 0 || lifecycleResult.result.restartedIr.files !== 10) {
  await saveReport(report);
  throw new Error("utilityProcess lifecycle gate failed");
}
report.status = "COMPLETE";
await saveReport(report);
console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = "FAILED";
  report.failure ??= {};
  report.failure.runner = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
  await saveReport(report);
  console.error(`executor measurement failed; see ${output}`);
  process.exitCode = 1;
}

async function saveReport(value) {
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(value, null, 2)}\n`);
}

process.on("uncaughtException", async (error) => {
  report.status = "FAILED";
  report.failure ??= {};
  report.failure.runner = { message: error.message, stack: error.stack };
  await saveReport(report);
  process.exitCode = 1;
});

function run(candidate, command, args, requireSuccess = true, expectJson = true) {
  return new Promise((resolveRun) => {
    const startedAt = performance.now(); let ticks = 0; let maxDelayMs = 0; let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); maxDelayMs = Math.max(maxDelayMs, now - previous - 10); previous = now; ticks += 1; }, 10);
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; let spawnError;
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { spawnError = { code: error.code, message: error.message }; });
    child.on("close", (exitCode, signal) => {
      clearInterval(timer);
      const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
      const line = stdout.trim().split("\n").at(-1);
      let result;
      let resultParseError;
      if (line && expectJson) {
        try {
          result = { ...JSON.parse(line), wallTimeMs: elapsedMs, uiResponsiveness: { timerTicks: ticks, maxDelayMs } };
        } catch (error) {
          resultParseError = error instanceof Error ? error.message : String(error);
        }
      }
      resolveRun({ ok: !spawnError && !resultParseError && (!requireSuccess || exitCode === 0), candidate, command, cwd: root, exitCode, signal, stdout, stderr, elapsedMs, spawnError, resultParseError, result });
    });
  });
}
