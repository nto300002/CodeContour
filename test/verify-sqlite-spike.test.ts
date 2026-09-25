import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
const verifierPath = new URL("../scripts/verify-sqlite-spike.mjs", import.meta.url);

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function completeSmoke(sampleCount: number) {
  return {
    status: "COMPLETE",
    heartbeatSampleCount: sampleCount,
    packagingElapsedMs: 1,
    packageBytes: 1,
    candidates: ["better-sqlite3", "node:sqlite"].map((driver) => ({
      driver,
      status: "COMPLETE",
      samples: Array.from({ length: sampleCount }, () => ({ smoke: { driver, value: "ok" } })),
      mainEventLoopP95Ms: 1,
    })),
  };
}

async function runVerifier(smoke: ReturnType<typeof completeSmoke>) {
  const directory = await mkdtemp(join(tmpdir(), "codecontour-verify-sqlite-spike-"));
  directories.push(directory);
  const measurementPath = join(directory, "measurement.json");
  const smokePath = join(directory, "smoke.json");
  await writeFile(measurementPath, JSON.stringify({
    status: "COMPLETE",
    candidates: [{ driver: "better-sqlite3" }, { driver: "node:sqlite" }],
  }));
  await writeFile(smokePath, JSON.stringify(smoke));
  return spawnSync(process.execPath, [fileURLToPath(verifierPath), measurementPath, smokePath], { encoding: "utf8" });
}

describe("verify SQLite spike reports", () => {
  it("requires exactly five heartbeat samples for each driver", async () => {
    expect((await runVerifier(completeSmoke(5))).status).toBe(0);
    expect((await runVerifier(completeSmoke(1))).stderr).toContain("exactly 5 heartbeat samples");
  });
});
