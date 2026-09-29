const { app, utilityProcess } = require("electron");
const path = require("path");
const input = JSON.parse(process.argv[process.argv.length - 1]);
app.whenReady().then(() => {
  const child = utilityProcess.fork(path.join(__dirname, "executor-spike-task.cjs"));
  child.on("error", (error) => { console.error(error); app.exit(1); });
  child.on("exit", (code) => { if (code !== 0) { console.error(`utilityProcess exited: ${code}`); app.exit(1); } });
  child.on("message", (message) => {
    if (message.type === "READY") { child.postMessage({ type: "RUN", input }); if (input.cancelAfterMs) setTimeout(() => child.postMessage({ type: "CANCEL" }), input.cancelAfterMs); }
    if (message.type === "RESULT" || message.type === "CANCELLED") { process.stdout.write(`${JSON.stringify(message)}\n`); app.quit(); }
  });
});
