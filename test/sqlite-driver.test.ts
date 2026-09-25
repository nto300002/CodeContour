import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeSqliteDriver, type SqliteMigration } from "../src/sqlite-driver.js";

const migrations: SqliteMigration[] = [
  { version: 1, sql: "CREATE TABLE project (id TEXT PRIMARY KEY);" },
  { version: 2, sql: "CREATE TABLE snapshot (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id));" },
];

describe("NodeSqliteDriver", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("runs versioned migrations and enables WAL plus foreign keys for a file-backed database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codecontour-sqlite-"));
    temporaryDirectories.push(directory);
    const driver = new NodeSqliteDriver(join(directory, "project.db"));

    driver.applyMigrations(migrations);
    driver.applyMigrations(migrations);

    expect(driver.all<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")).toEqual([{ version: 1 }, { version: 2 }]);
    expect(driver.get<{ journal_mode: string }>("PRAGMA journal_mode")?.journal_mode).toBe("wal");
    expect(driver.get<{ foreign_keys: number }>("PRAGMA foreign_keys")?.foreign_keys).toBe(1);
    expect(() => driver.run("INSERT INTO snapshot (id, project_id) VALUES (?, ?)", "snapshot-1", "missing-project")).toThrow();
    driver.close();
  });

  it("rolls back a failed transaction without leaving partial writes", async () => {
    const driver = new NodeSqliteDriver(":memory:");
    driver.applyMigrations(migrations);

    expect(() => driver.transaction(() => {
      driver.run("INSERT INTO project (id) VALUES (?)", "project-1");
      throw new Error("abort transaction");
    })).toThrow("abort transaction");

    expect(driver.all("SELECT id FROM project")).toEqual([]);
    driver.close();
  });

  it("keeps completed migrations and recovers from a later migration failure", () => {
    const driver = new NodeSqliteDriver(":memory:");
    expect(() => driver.applyMigrations([
      { version: 1, sql: "CREATE TABLE preserved (id TEXT PRIMARY KEY);" },
      { version: 2, sql: "CREATE TABLE broken (" },
    ])).toThrow();

    expect(driver.all<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")).toEqual([{ version: 1 }]);
    driver.run("INSERT INTO preserved (id) VALUES (?)", "survives");
    driver.applyMigrations([
      { version: 1, sql: "CREATE TABLE preserved (id TEXT PRIMARY KEY);" },
      { version: 2, sql: "CREATE TABLE recovered (id TEXT PRIMARY KEY);" },
    ]);
    expect(driver.all<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")).toEqual([{ version: 1 }, { version: 2 }]);
    expect(driver.all<{ id: string }>("SELECT id FROM preserved")).toEqual([{ id: "survives" }]);
    driver.close();
  });
});
