import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputPath = "docs/adr-002-sqlite-packaged-smoke.json";
const packageStartedAt = Date.now();
const packageResult = spawnSync("npm", ["run", "package:sqlite-spike"], { encoding: "utf8" });
const packagingElapsedMs = Date.now() - packageStartedAt;

if (packageResult.status !== 0) {
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    status: "FAILED",
    stage: "PACKAGE",
    nodeVersion: process.version,
    packagingElapsedMs,
    exitCode: packageResult.status,
    signal: packageResult.signal,
    stdout: packageResult.stdout,
    stderr: packageResult.stderr,
  }, null, 2)}\n`);
  process.stderr.write(packageResult.stderr);
  process.exitCode = 1;
} else {
  const smokeResult = spawnSync("node", ["scripts/smoke-packaged-sqlite.mjs"], {
    encoding: "utf8",
    env: { ...process.env, CODECONTOUR_SQLITE_PACKAGED_OUTPUT: outputPath, CODECONTOUR_SQLITE_PACKAGING_ELAPSED_MS: String(packagingElapsedMs) },
  });
  process.stdout.write(smokeResult.stdout);
  process.stderr.write(smokeResult.stderr);
  process.exitCode = smokeResult.status ?? 1;
}
