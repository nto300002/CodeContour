import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDriver, NodeSqliteDriver, type SqliteDriver } from "../src/sqlite-driver.js";
import { SqliteSnapshotService } from "../src/sqlite-snapshot-service.js";

describe.each([
  ["node:sqlite", (path: string): SqliteDriver => new NodeSqliteDriver(path)],
  ["better-sqlite3", (path: string): SqliteDriver => new BetterSqliteDriver(path)],
] as const)("Snapshot contract: %s", (_name, createDriver) => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("bulk-inserts a Staging cache and promotes it atomically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codecontour-snapshot-contract-"));
    directories.push(directory);
    const driver = createDriver(join(directory, "project.db"));
    const service = new SqliteSnapshotService(driver);
    service.migrate();
    service.createProject("project", "active-a");
    service.startRun("project", "run-b", "staging-b");
    const records = Array.from({ length: 1_000 }, (_, index) => `symbol-${index}`);

    expect(service.acceptBatch({ analysisRunId: "run-b", stagingSnapshotId: "staging-b", sequenceNumber: 1, records })).toEqual({ accepted: true });
    service.promote("project", "run-b");

    expect(service.project("project")?.activeSnapshotId).toBe("staging-b");
    expect(service.records("staging-b")).toHaveLength(1_000);
    driver.close();
  });
});
