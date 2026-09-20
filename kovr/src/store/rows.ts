/**
 * Typed accessors for SQLite rows.
 *
 * `node:sqlite` hands back null-prototype objects of `string | number | null`.
 * Reading a column through these helpers turns a schema drift into a loud
 * error at the boundary rather than an `undefined` that travels into a payout.
 */

import type { Row, SqlValue } from './db.js';

export class RowError extends Error {
  constructor(column: string, detail: string) {
    super(`column "${column}" ${detail}`);
    this.name = 'RowError';
  }
}

function raw(row: Row, column: string): SqlValue {
  if (!(column in row)) throw new RowError(column, 'is not present in the result set');
  return row[column] ?? null;
}

export function str(row: Row, column: string): string {
  const value = raw(row, column);
  if (typeof value !== 'string') throw new RowError(column, `is not a string (got ${typeof value})`);
  return value;
}

export function strOrNull(row: Row, column: string): string | null {
  const value = raw(row, column);
  if (value === null) return null;
  if (typeof value !== 'string') throw new RowError(column, `is not a string (got ${typeof value})`);
  return value;
}

export function num(row: Row, column: string): number {
  const value = raw(row, column);
  if (typeof value !== 'number') throw new RowError(column, `is not a number (got ${typeof value})`);
  return value;
}

export function numOrNull(row: Row, column: string): number | null {
  const value = raw(row, column);
  if (value === null) return null;
  if (typeof value !== 'number') throw new RowError(column, `is not a number (got ${typeof value})`);
  return value;
}

/** SQLite has no boolean type; KOVR stores 0/1 with a CHECK constraint. */
export function bool(row: Row, column: string): boolean {
  return num(row, column) === 1;
}

export function boolOrNull(row: Row, column: string): boolean | null {
  const value = numOrNull(row, column);
  return value === null ? null : value === 1;
}

export const toSqlBool = (value: boolean): number => (value ? 1 : 0);

/** Narrow a text column to a known union, rejecting anything unexpected. */
export function enumOf<T extends string>(row: Row, column: string, allowed: readonly T[]): T {
  const value = str(row, column);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new RowError(column, `holds unexpected value "${value}"`);
  }
  return value as T;
}
