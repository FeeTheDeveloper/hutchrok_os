/**
 * Hutchrok OS — SQL adapter helpers
 *
 * The activity kernel defines its store interfaces as ports; these adapters
 * are the Postgres implementations. Every statement that must be atomic is
 * written as raw SQL rather than built by the query builder, because the
 * atomicity *is* the contract:
 *
 *   - receipts: INSERT ... ON CONFLICT DO UPDATE RETURNING (xmax = 0)
 *   - schedules: CTE + FOR UPDATE SKIP LOCKED
 *   - transitions: UPDATE ... WHERE status IN (...) RETURNING
 *
 * Writing these by hand keeps the guarantee visible and driver-independent.
 */

import type { SQL } from 'drizzle-orm';

/**
 * Minimal surface these stores need. Satisfied by any drizzle Postgres
 * database — postgres-js in the API, PGlite in tests.
 */
export interface SqlExecutor {
  execute(query: SQL): Promise<unknown>;
}

/**
 * Drivers disagree on the result shape: postgres-js returns the rows array
 * directly, node-postgres and PGlite return `{ rows }`. Normalize both.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result !== null && typeof result === 'object') {
    const maybe = (result as { rows?: unknown }).rows;
    if (Array.isArray(maybe)) return maybe as T[];
  }
  return [];
}

export function firstRow<T>(result: unknown): T | null {
  const rows = rowsOf<T>(result);
  return rows.length > 0 ? (rows[0] as T) : null;
}

// ─────────────────────────────────────────
// COLUMN COERCION
//
// Postgres hands back Date for timestamptz, string for numeric, and already
// parsed objects for jsonb — but the exact types vary by driver. The domain
// models are all ISO strings and plain JS values, so coerce at the boundary.
// ─────────────────────────────────────────

/** timestamptz → ISO 8601 string. */
export function toISO(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof value === 'number') return new Date(value).toISOString();
  throw new Error(`Cannot read ${JSON.stringify(value)} as a timestamp.`);
}

/** Nullable timestamptz → ISO string or undefined (domain uses optional, not null). */
export function toISOOptional(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return toISO(value);
}

/** NULL → undefined, so rows satisfy `exactOptionalPropertyTypes` domain types. */
export function toStringOptional(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

export function toInt(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    if (!Number.isNaN(n)) return n;
  }
  throw new Error(`Cannot read ${JSON.stringify(value)} as an integer.`);
}

export function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 't' || value === 'true' || value === 1 || value === '1') return true;
  if (value === 'f' || value === 'false' || value === 0 || value === '0') return false;
  throw new Error(`Cannot read ${JSON.stringify(value)} as a boolean.`);
}

/** jsonb → object. Some drivers return the raw JSON text. */
export function toRecord(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** jsonb array → string[]. */
export function toStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/** Reads a column out of a row, erroring rather than silently yielding undefined. */
export function col(row: Record<string, unknown>, name: string): unknown {
  if (!(name in row)) {
    throw new Error(`Row is missing expected column "${name}".`);
  }
  return row[name];
}
