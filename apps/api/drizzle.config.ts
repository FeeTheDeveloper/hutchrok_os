/**
 * Hutchrok OS — Drizzle Kit configuration
 *
 * `pnpm db:generate` reads both schema modules: the core schema and the
 * activity kernel schema, which imports its enums and parent tables from
 * the core but is not re-exported by it (keeps the module graph acyclic).
 *
 * Migrations are written to infrastructure/database/migrations and applied
 * by `pnpm db:migrate`. Generating a migration needs no database connection;
 * applying one does.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  // index.ts re-exports both the core schema and the activity kernel schema.
  schema: '../../infrastructure/database/index.ts',
  out: '../../infrastructure/database/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  strict: true,
  verbose: true,
});
