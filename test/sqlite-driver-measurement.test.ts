import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDriver, NodeSqliteDriver, type SqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";

interface CandidateMeasurement {
  driver: "node:sqlite" | "better-sqlite3";
  migrationMs: number;
  bulkInsertMs: number;
  promotionMs: number;
  databaseBytes: number;
  records: number;
}

const outputPath = process.env.CODECONTOUR_SQLITE_MEASUREMENT_OUTPUT;
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function measure(driverName: CandidateMeasurement["driver"], createDriver: (path: string) => SqliteDriver): Promise<CandidateMeasurement> {
  const directory = await mkdtemp(join(tmpdir(), "codecontour-sqlite-measurement-"));
  directories.push(directory);
  const databasePath = join(directory, "project.db");
  const driver = createDriver(databasePath);
  const service = new SqliteSnapshotService(driver);
  const migrationStartedAt = performance.now();
  service.migrate();
  service.createProject("project", "active-a");
  const migrationMs = performance.now() - migrationStartedAt;

  service.startRun("project", "run-b", "staging-b");
  const records = Array.from({ length: 1_000 }, (_, index) => `symbol-${index}`);
  const bulkStartedAt = performance.now();
  expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 1, records })).toEqual({ accepted: true });
  const bulkInsertMs = performance.now() - bulkStartedAt;
  const promotionStartedAt = performance.now();
  service.promote("project", "run-b");
  const promotionMs = performance.now() - promotionStartedAt;
  expect(service.records("staging-b")).toHaveLength(records.length);
  driver.close();

  return { driver: driverName, migrationMs, bulkInsertMs, promotionMs, databaseBytes: (await stat(databasePath)).size, records: records.length };
}

describe("SQLite driver comparison measurement", () => {
  it("measures both candidates through the same schema, migration, and snapshot service", async () => {
    const candidates = await Promise.all([
      measure("node:sqlite", (path) => new NodeSqliteDriver(path)),
      measure("better-sqlite3", (path) => new BetterSqliteDriver(path)),
    ]);
    expect(candidates.every((candidate) => candidate.records === 1_000 && candidate.databaseBytes > 0)).toBe(true);

    if (outputPath) {
      await writeFile(outputPath, `${JSON.stringify({
        status: "COMPLETE",
        measuredAt: new Date().toISOString(),
        method: "same SqliteSnapshotService, 1,000-record Analyzer Cache batch",
        candidates,
      }, null, 2)}\n`);
    }
  });
});
