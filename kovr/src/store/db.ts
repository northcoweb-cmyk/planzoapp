/**
 * SQLite access layer, built on Node's own `node:sqlite` module.
 *
 * KOVR has no runtime dependencies: the database is a real relational store
 * with foreign keys, CHECK constraints and indexes, and it ships inside Node.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fromRoot } from '../config/paths.js';
import { config } from '../config/env.js';

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export class Database {
  private readonly db: DatabaseSync;
  private readonly statements = new Map<string, ReturnType<DatabaseSync['prepare']>>();
  private depth = 0;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    // WAL keeps reads from blocking the settlement writer.
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(readFileSync(fromRoot('src/store/schema.sql'), 'utf8'));
  }

  private stmt(sql: string): ReturnType<DatabaseSync['prepare']> {
    let prepared = this.statements.get(sql);
    if (!prepared) {
      prepared = this.db.prepare(sql);
      this.statements.set(sql, prepared);
    }
    return prepared;
  }

  all<T extends Row = Row>(sql: string, ...params: SqlValue[]): T[] {
    return this.stmt(sql).all(...params) as unknown as T[];
  }

  get<T extends Row = Row>(sql: string, ...params: SqlValue[]): T | null {
    const row = this.stmt(sql).get(...params);
    return (row ?? null) as T | null;
  }

  run(sql: string, ...params: SqlValue[]): { changes: number; lastInsertRowid: number } {
    const result = this.stmt(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Run `fn` inside a transaction. Nested calls join the outer transaction
   * via savepoints, so a service can compose without knowing its caller.
   * Every money-moving operation goes through here.
   */
  transaction<T>(fn: () => T): T {
    const isOuter = this.depth === 0;
    const savepoint = `kovr_sp_${this.depth}`;
    this.db.exec(isOuter ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      this.db.exec(isOuter ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.depth--;
      try {
        this.db.exec(isOuter ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}`);
        if (!isOuter) this.db.exec(`RELEASE ${savepoint}`);
      } catch {
        // A rollback failure must not mask the original error.
      }
      throw error;
    }
  }

  close(): void {
    this.statements.clear();
    this.db.close();
  }
}

let instance: Database | null = null;

export function db(): Database {
  if (!instance) instance = new Database(config().dbPath);
  return instance;
}

/** Test helper: swap in an in-memory database. */
export function useDatabase(database: Database): void {
  instance = database;
}

export function createInMemoryDatabase(): Database {
  return new Database(':memory:');
}

/** True when an error is SQLite refusing a duplicate on a UNIQUE column. */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /UNIQUE constraint failed/i.test(error.message);
}
