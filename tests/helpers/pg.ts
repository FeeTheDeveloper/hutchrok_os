/**
 * Real Postgres for tests, in-process.
 *
 * PGlite is Postgres compiled to WASM, so the SQL under test is executed by
 * the actual engine — `ON CONFLICT`, `xmax`, CTEs and `FOR UPDATE SKIP
 * LOCKED` all behave as they will in production. No Docker, no daemon.
 *
 * The schema comes from the committed migration files rather than a
 * test-only DDL script, so a migration that does not apply fails these tests.
 */

import { readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../infrastructure/database/migrations');

export type TestDb = ReturnType<typeof drizzle>;

export interface TestDatabase {
  db: TestDb;
  client: PGlite;
  close: () => Promise<void>;
}

/**
 * Applies the committed migrations with drizzle's own migrator — the same
 * path `pnpm db:migrate` takes. That means the journal, the breakpoints and
 * the migration hashes are all exercised, not just the raw SQL text.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  await client.waitReady;

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  if (files.length === 0) {
    throw new Error(`No migrations found in ${migrationsDir}.`);
  }

  const db = drizzle(client);
  await migrate(db, { migrationsFolder: migrationsDir });

  return {
    db,
    client,
    close: async () => {
      await client.close();
    },
  };
}
