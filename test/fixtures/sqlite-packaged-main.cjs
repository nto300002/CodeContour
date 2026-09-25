const { app } = require("electron");
const { join } = require("node:path");
const { performance } = require("node:perf_hooks");

const driverName = process.env.CODECONTOUR_SQLITE_DRIVER || "better-sqlite3";

function openDatabase(path) {
  if (driverName === "better-sqlite3") {
    const BetterSqlite3 = require("better-sqlite3");
    return new BetterSqlite3(path);
  }
  if (driverName === "node:sqlite") {
    const { DatabaseSync } = require("node:sqlite");
    return new DatabaseSync(path);
  }
  throw new Error(`Unsupported SQLite driver: ${driverName}`);
}

async function main() {
  await app.whenReady();
  const database = openDatabase(join(app.getPath("temp"), `codecontour-sqlite-smoke-${driverName}-${process.pid}.db`));
  try {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec("CREATE TABLE IF NOT EXISTS smoke (id TEXT PRIMARY KEY, value TEXT NOT NULL);");
    database.prepare("INSERT OR REPLACE INTO smoke (id, value) VALUES (?, ?)").run("packaged", "ok");
    const row = database.prepare("SELECT value FROM smoke WHERE id = ?").get("packaged");
    const expectedAt = performance.now() + 5;
    const heartbeatPromise = new Promise((resolve) => setTimeout(() => resolve(Math.max(0, performance.now() - expectedAt)), 5));
    const insertHeartbeat = database.prepare("INSERT OR REPLACE INTO smoke (id, value) VALUES (?, ?)");
    database.exec("BEGIN IMMEDIATE;");
    for (let index = 0; index < 10_000; index += 1) insertHeartbeat.run(`heartbeat-${index}`, "ok");
    database.exec("COMMIT;");
    const heartbeat = await heartbeatPromise;
    process.stdout.write(`${JSON.stringify({ type: "SQLITE_PACKAGED_SMOKE", driver: driverName, value: row.value, arch: process.arch, mainEventLoopDelayMs: heartbeat })}\n`);
    app.quit();
  } finally {
    database.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  app.exit(1);
});
