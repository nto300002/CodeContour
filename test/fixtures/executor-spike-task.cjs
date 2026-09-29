const ts = require("typescript");
const { parentPort } = require("worker_threads");

async function analyze(input, isCancelled, progress) {
  if (input.crash) process.exit(42);
  const startedAt = performance.now();
  const files = [];
  for (const [index, source] of input.files.entries()) {
    if (isCancelled()) return { type: "CANCELLED_DURING_ANALYSIS" };
    files.push(ts.createSourceFile(`file-${index}.ts`, source, ts.ScriptTarget.ES2022));
    progress(index + 1);
    // Yield between File units so a Main-process CANCEL can be observed mid-analysis.
    await new Promise((resolve) => setImmediate(resolve));
  }
  if (isCancelled()) return { type: "CANCELLED_DURING_ANALYSIS" };
  const declarations = files.reduce((total, file) => total + file.statements.length, 0);
  return { ir: { files: files.length, declarations }, analysisTimeMs: Math.round((performance.now() - startedAt) * 100) / 100 };
}

let cancelled = false;
async function receive(message, send) {
  if (message.type === "PING") return send({ type: "PONG", id: message.id });
  if (message.type === "CANCEL") { cancelled = true; send({ type: "CANCELLED" }); return setTimeout(() => send({ type: "LATE_BATCH", batch: { analysisRunId: "run", stagingSnapshotId: "staging", sequenceNumber: 1 } }), 5); }
  if (message.type === "RUN") {
    if (message.input.delayMs) await new Promise((resolve) => setTimeout(resolve, message.input.delayMs));
    if (cancelled) return;
    const result = await analyze(message.input, () => cancelled, (completedFiles) => send({ type: "ANALYSIS_PROGRESS", completedFiles }));
    if (result.type === "CANCELLED_DURING_ANALYSIS") return;
    send({ type: "RESULT", ...result, maxRssBytes: process.resourceUsage().maxRSS * 1024, messageBytes: Buffer.byteLength(JSON.stringify(message.input)) });
  }
}

if (parentPort) parentPort.on("message", (message) => receive(message, (value) => parentPort.postMessage(value)));
else if (process.parentPort) {
  process.parentPort.postMessage({ type: "READY" });
  process.parentPort.on("message", (message) => receive(message.data, (value) => process.parentPort.postMessage(value)));
} else {
  process.send({ type: "READY" });
  process.on("message", (message) => receive(message, (value) => process.send(value)));
}
