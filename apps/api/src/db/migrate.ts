/**
 * Hutchrok OS — Migration runner (`pnpm db:migrate`)
 *
 * Applies pending migrations from infrastructure/database/migrations.
 *
 * This is additive-only by policy: destructive migrations against production
 * data require owner approval (CLAUDE.md escalation list), so this runner
 * refuses to run against a production DATABASE_URL unless the operator
 * explicitly sets HUTCHROK_ALLOW_PROD_MIGRATION=1.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { getDb, closeDb } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../../../../infrastructure/database/migrations');

function assertNotUnapprovedProduction(): void {
  const appEnv = process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'local';
  const isProd = appEnv === 'production';
  const approved = process.env['HUTCHROK_ALLOW_PROD_MIGRATION'] === '1';

  if (isProd && !approved) {
    throw new Error(
      'Refusing to migrate a production database without approval. ' +
        'Production migrations require Level C approval; set HUTCHROK_ALLOW_PROD_MIGRATION=1 only once that is recorded.'
    );
  }
}

async function main(): Promise<void> {
  assertNotUnapprovedProduction();

  console.log(`[db:migrate] applying migrations from ${migrationsFolder}`);
  await migrate(getDb(), { migrationsFolder });
  console.log('[db:migrate] done');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('[db:migrate] failed:', error instanceof Error ? error.message : error);
    await closeDb();
    process.exit(1);
  });
