const { Worker } = require("worker_threads");
const path = require("path");
const input = JSON.parse(process.argv[2]);
const worker = new Worker(path.join(__dirname, "executor-spike-task.cjs"));
let completed = false;
worker.on("message", (message) => {
  if (message.type === "ANALYSIS_PROGRESS") return;
  completed = true;
  process.stdout.write(`${JSON.stringify(message)}\n`);
  worker.terminate();
});
worker.once("error", () => process.exit(1));
worker.once("exit", (code) => { if (!completed && code !== 0) process.exit(code); });
worker.postMessage({ type: "RUN", input });
if (input.cancelAfterMs) setTimeout(() => worker.postMessage({ type: "CANCEL" }), input.cancelAfterMs);
