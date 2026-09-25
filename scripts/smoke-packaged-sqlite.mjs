import { spawnSync } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const outputPath = process.env.CODECONTOUR_SQLITE_PACKAGED_OUTPUT;
const packageRoot = "out";
const sampleCount = 5;

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat();
}

async function totalBytes(paths) {
  const sizes = await Promise.all(paths.map(async (path) => (await stat(path)).size));
  return sizes.reduce((total, size) => total + size, 0);
}

function percentile95(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}

async function main() {
  let report;
  try {
    const files = await filesBelow(packageRoot);
    const executable = files.find((path) => /\.app\/Contents\/MacOS\/[^/]+$/.test(path) && !path.includes("/Contents/Frameworks/"));
    if (!executable) throw new Error("Packaged Electron executable was not found");
    const candidates = ["better-sqlite3", "node:sqlite"].map((driver) => {
      const samples = Array.from({ length: sampleCount }, () => {
        const startedAt = Date.now();
        const result = spawnSync(executable, [], { encoding: "utf8", timeout: 30_000, env: { ...process.env, CODECONTOUR_SQLITE_DRIVER: driver } });
        const smoke = result.stdout.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
          try { return JSON.parse(line); } catch { return undefined; }
        }).find((value) => value?.type === "SQLITE_PACKAGED_SMOKE");
        return { elapsedMs: Date.now() - startedAt, exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, smoke };
      });
      const delays = samples.map((sample) => sample.smoke?.mainEventLoopDelayMs).filter((delay) => typeof delay === "number");
      return { driver, status: samples.length === delays.length && samples.every((sample) => sample.exitCode === 0 && sample.smoke?.driver === driver && sample.smoke?.value === "ok") ? "COMPLETE" : "FAILED", samples, mainEventLoopP95Ms: delays.length === sampleCount ? percentile95(delays) : undefined };
    });
    report = {
      status: candidates.every((candidate) => candidate.status === "COMPLETE") ? "COMPLETE" : "FAILED",
      executable,
      packagingElapsedMs: Number(process.env.CODECONTOUR_SQLITE_PACKAGING_ELAPSED_MS ?? 0),
      heartbeatSampleCount: sampleCount,
      candidates,
      packageBytes: await totalBytes(files.filter((path) => path.includes(".app/"))),
      nodeVersion: process.version,
    };
  } catch (error) {
    report = {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      nodeVersion: process.version,
    };
  }
  if (outputPath) {
    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (report.status !== "COMPLETE") throw new Error(`Packaged SQLite smoke failed: ${JSON.stringify(report)}`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
