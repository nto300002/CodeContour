import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDriver, NodeSqliteDriver, type SqliteDriver } from "../src/sqlite-driver.js";

const migrations = [
  { version: 1, sql: "CREATE TABLE parent (id TEXT PRIMARY KEY); CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent(id));" },
];

describe.each([
  ["node:sqlite", (path: string): SqliteDriver => new NodeSqliteDriver(path)],
  ["better-sqlite3", (path: string): SqliteDriver => new BetterSqliteDriver(path)],
] as const)("SQLiteDriver contract: %s", (_name, createDriver) => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("uses the same migration, foreign-key, WAL, and rollback behavior", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codecontour-driver-contract-"));
    directories.push(directory);
    const driver = createDriver(join(directory, "driver.db"));
    driver.applyMigrations(migrations);

    expect(driver.get<{ journal_mode: string }>("PRAGMA journal_mode")?.journal_mode).toBe("wal");
    expect(driver.get<{ foreign_keys: number }>("PRAGMA foreign_keys")?.foreign_keys).toBe(1);
    expect(() => driver.run("INSERT INTO child (id, parent_id) VALUES (?, ?)", "child-1", "missing")).toThrow();
    expect(() => driver.transaction(() => {
      driver.run("INSERT INTO parent (id) VALUES (?)", "parent-1");
      throw new Error("rollback");
    })).toThrow("rollback");
    expect(driver.all("SELECT id FROM parent")).toEqual([]);
    driver.close();
  });

  it("keeps prior migration versions when a later version fails, then recovers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codecontour-migration-recovery-"));
    directories.push(directory);
    const driver = createDriver(join(directory, "driver.db"));

    expect(() => driver.applyMigrations([
      { version: 1, sql: "CREATE TABLE preserved (id TEXT PRIMARY KEY);" },
      { version: 2, sql: "CREATE TABLE broken (" },
    ])).toThrow();
    expect(driver.all<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")).toEqual([{ version: 1 }]);

    driver.applyMigrations([
      { version: 1, sql: "CREATE TABLE preserved (id TEXT PRIMARY KEY);" },
      { version: 2, sql: "CREATE TABLE recovered (id TEXT PRIMARY KEY);" },
    ]);
    expect(driver.all<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")).toEqual([{ version: 1 }, { version: 2 }]);
    driver.close();
  });
});
