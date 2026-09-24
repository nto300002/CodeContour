const { app, utilityProcess } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const input = JSON.parse(process.argv[process.argv.length - 1]);
let heartbeats = 0;
let heartbeatMaxDelayMs = 0;
let lastHeartbeatAt = performance.now();
let heartbeatWindowStarted = false;
let heartbeatObservationCount = 0;
const heartbeatDelaysMs = [];
let child;
let ipcResponseCount = 0;
let ipcMaxRoundTripMs = 0;
const ipcRoundTripsMs = [];
let nextPingId = 0;
const pendingPings = new Map();
const lifecycle = { crashExitCode: undefined, heartbeatContinued: false, restartedIr: undefined, cancelled: false, cancelledDuringAnalysis: false };
let batchController;
let savedBatches;

function fork(task, afterResult) {
  child = utilityProcess.fork(path.join(__dirname, "executor-spike-task.cjs"));
  child.on("message", (message) => {
    if (message.type === "READY") { child.postMessage({ type: "RUN", input: task }); if (task.cancelAfterMs) setTimeout(() => child.postMessage({ type: "CANCEL" }), task.cancelAfterMs); }
    if (message.type === "ANALYSIS_PROGRESS" && task.cancelDuringAnalysis && !lifecycle.cancelRequested) {
      lifecycle.cancelRequested = true;
      lifecycle.cancelledDuringAnalysis = true;
      child.postMessage({ type: "CANCEL" });
    }
    if (message.type === "PONG") {
      const startedAt = pendingPings.get(message.id);
      if (startedAt !== undefined) {
        pendingPings.delete(message.id);
        ipcResponseCount += 1;
        const roundTripMs = performance.now() - startedAt;
        ipcRoundTripsMs.push(roundTripMs);
        ipcMaxRoundTripMs = Math.max(ipcMaxRoundTripMs, roundTripMs);
      }
    }
    if (message.type === "RESULT") { lifecycle.restartedIr = message.ir; afterResult?.(); }
    if (message.type === "CANCELLED") lifecycle.cancelled = true;
    if (message.type === "LATE_BATCH") { const result = batchController.receiveFromExecutor({ type: "ANALYSIS_BATCH", batch: message.batch }); lifecycle.cancelledBatchRejected = !result.accepted && result.reason === "RUN_CANCELLED"; lifecycle.cancelledBatchSaveCount = savedBatches.length; }
  });
  child.on("exit", (code) => {
    if (task.crash) {
      const beforeRestart = heartbeats;
      setTimeout(() => fork({ files: input.files }, () => fork({ files: input.files, cancelDuringAnalysis: true })), 30);
      lifecycle.crashExitCode = code;
      setTimeout(() => { lifecycle.heartbeatContinued = heartbeats > beforeRestart; }, 80);
    }
  });
}

app.whenReady().then(async () => {
  const dist = process.env.CODECONTOUR_SPIKE_DIST;
  const { AnalysisBatchGate } = await import(pathToFileURL(path.join(dist, "src", "analysis-batch-gate.js")));
  const { AnalysisBatchController } = await import(pathToFileURL(path.join(dist, "src", "analysis-batch-controller.js")));
  const gate = new AnalysisBatchGate("active"); gate.begin({ analysisRunId: "run", stagingSnapshotId: "staging" }); gate.cancel("run");
  savedBatches = [];
  batchController = new AnalysisBatchController(gate, { saveStaging: (batch) => savedBatches.push(batch) });
  const timer = setInterval(() => {
    const now = performance.now();
    if (heartbeatWindowStarted) {
      const delayMs = now - lastHeartbeatAt - 5;
      heartbeatDelaysMs.push(delayMs);
      heartbeatMaxDelayMs = Math.max(heartbeatMaxDelayMs, delayMs);
      heartbeatObservationCount += 1;
    }
    lastHeartbeatAt = now;
    heartbeats += 1;
  }, 5);
  const ipcTimer = setInterval(() => {
    if (!heartbeatWindowStarted || !child) return;
    const id = ++nextPingId;
    pendingPings.set(id, performance.now());
    child.postMessage({ type: "PING", id });
  }, 20);
  // Exclude Electron bootstrap and the first utilityProcess spawn from the UI-response window.
  setTimeout(() => { heartbeatMaxDelayMs = 0; lastHeartbeatAt = performance.now(); heartbeatWindowStarted = true; }, 150);
  fork({ files: input.files, crash: true });
  setTimeout(() => {
    clearInterval(timer);
    clearInterval(ipcTimer);
    const sortedHeartbeatDelays = [...heartbeatDelaysMs].sort((left, right) => left - right);
    const heartbeatP95DelayMs = sortedHeartbeatDelays[Math.max(0, Math.ceil(sortedHeartbeatDelays.length * 0.95) - 1)] ?? null;
    const sortedIpcRoundTrips = [...ipcRoundTripsMs].sort((left, right) => left - right);
    const ipcP95RoundTripMs = sortedIpcRoundTrips[Math.max(0, Math.ceil(sortedIpcRoundTrips.length * 0.95) - 1)] ?? null;
    process.stdout.write(`${JSON.stringify({ type: "LIFECYCLE", heartbeats, heartbeatMaxDelayMs, heartbeatWindowStarted, heartbeatObservationCount, heartbeatP95DelayMs, ipcResponseCount, ipcMaxRoundTripMs, ipcP95RoundTripMs, ...lifecycle })}\n`);
    app.quit();
  }, 700);
}).catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.stdout.write(`${JSON.stringify({ type: "LIFECYCLE_FAILURE", message: error.message })}\n`);
  app.exit(1);
});
