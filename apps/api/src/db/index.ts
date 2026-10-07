/**
 * Hutchrok OS — Database client
 *
 * One lazily-created postgres connection per process. Nothing here reads
 * DATABASE_URL at import time, so the API can boot (and health routes can
 * answer) when the database is not configured — the activity kernel runs on
 * in-memory stores in local development.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as dbSchema from '@hutchrok-os/db';

export const schema = dbSchema;
export type Schema = typeof schema;

let client: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase<Schema> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env['DATABASE_URL']);
}

/** The shared connection. Throws if DATABASE_URL is unset. */
export function getDb(): PostgresJsDatabase<Schema> {
  if (db) return db;

  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Start the database with `docker compose up db -d` and copy .env.example to .env.'
    );
  }

  client = postgres(url, { max: 10, onnotice: () => {} });
  db = drizzle(client, { schema });
  return db;
}

/** Closes the pool. Call on shutdown and at the end of scripts. */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    db = null;
  }
}
