import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import BetterSqlite3 from "better-sqlite3";

export interface SqliteMigration {
  version: number;
  sql: string;
}

export interface SqliteDriver {
  applyMigrations(migrations: readonly SqliteMigration[]): void;
  transaction<T>(work: () => T): T;
  run(sql: string, ...parameters: SQLInputValue[]): void;
  get<T extends Record<string, unknown>>(sql: string, ...parameters: SQLInputValue[]): T | undefined;
  all<T extends Record<string, unknown>>(sql: string, ...parameters: SQLInputValue[]): T[];
  close(): void;
}

/**
 * Main-process-only SQLite boundary. Renderer and analyzer code receive neither
 * this driver nor its DatabaseSync connection.
 */
export class NodeSqliteDriver implements SqliteDriver {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON;");
    if (path !== ":memory:") this.database.exec("PRAGMA journal_mode = WAL;");
  }

  applyMigrations(migrations: readonly SqliteMigration[]): void {
    this.database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);");
    const applied = new Set(this.all<{ version: number }>("SELECT version FROM schema_migrations").map((migration) => migration.version));
    for (const migration of [...migrations].sort((left, right) => left.version - right.version)) {
      if (applied.has(migration.version)) continue;
      this.transaction(() => {
        this.database.exec(migration.sql);
        this.run("INSERT INTO schema_migrations (version) VALUES (?)", migration.version);
      });
    }
  }

  transaction<T>(work: () => T): T {
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const result = work();
      this.database.exec("COMMIT;");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  run(sql: string, ...parameters: SQLInputValue[]): void {
    this.database.prepare(sql).run(...parameters);
  }

  get<T extends Record<string, unknown>>(sql: string, ...parameters: SQLInputValue[]): T | undefined {
    return this.database.prepare(sql).get(...parameters) as T | undefined;
  }

  all<T extends Record<string, unknown>>(sql: string, ...parameters: SQLInputValue[]): T[] {
    return this.database.prepare(sql).all(...parameters) as T[];
  }

  close(): void {
    this.database.close();
  }
}

/** Native candidate for the packaged-app comparison. Main process only. */
export class BetterSqliteDriver implements SqliteDriver {
  private readonly database: BetterSqlite3.Database;

  constructor(path: string) {
    this.database = new BetterSqlite3(path);
    this.database.pragma("foreign_keys = ON");
    if (path !== ":memory:") this.database.pragma("journal_mode = WAL");
  }

  applyMigrations(migrations: readonly SqliteMigration[]): void {
    this.database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);");
    const applied = new Set(this.all<{ version: number }>("SELECT version FROM schema_migrations").map((migration) => migration.version));
    for (const migration of [...migrations].sort((left, right) => left.version - right.version)) {
      if (applied.has(migration.version)) continue;
      this.transaction(() => {
        this.database.exec(migration.sql);
        this.run("INSERT INTO schema_migrations (version) VALUES (?)", migration.version);
      });
    }
  }

  transaction<T>(work: () => T): T {
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const result = work();
      this.database.exec("COMMIT;");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  run(sql: string, ...parameters: SQLInputValue[]): void {
    this.database.prepare(sql).run(...parameters);
  }

  get<T extends Record<string, unknown>>(sql: string, ...parameters: SQLInputValue[]): T | undefined {
    return this.database.prepare(sql).get(...parameters) as T | undefined;
  }

  all<T extends Record<string, unknown>>(sql: string, ...parameters: SQLInputValue[]): T[] {
    return this.database.prepare(sql).all(...parameters) as T[];
  }

  close(): void {
    this.database.close();
  }
}
