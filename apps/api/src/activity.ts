/**
 * Activity kernel bootstrap — the shared receipt/assignment/exception/schedule
 * services every ingestion path uses.
 *
 * Backed by Postgres when DATABASE_URL is set, and by in-memory stores
 * otherwise, so the API still boots for local work without a database. The
 * Postgres adapters are the ones that actually enforce idempotency (unique
 * index + `ON CONFLICT`) and single-claim scheduling (`FOR UPDATE SKIP
 * LOCKED`); the in-memory ones only approximate it within one process.
 */

import {
  AssignmentService,
  ExceptionQueue,
  InMemoryAssignmentStore,
  InMemoryExceptionStore,
  InMemoryProviderReceiptStore,
  InMemoryScheduleStore,
  ProviderReceiptService,
  ScheduleService,
  type AssignmentStore,
  type ExceptionStore,
  type ProviderReceiptStore,
  type ScheduleStore,
} from '@hutchrok-os/activity';
import {
  PgAssignmentStore,
  PgExceptionStore,
  PgProviderReceiptStore,
  PgScheduleStore,
} from '@hutchrok-os/db/stores';
import type { TenantBinding } from '@hutchrok-os/domain';

import { getDb, isDatabaseConfigured } from './db/index.js';

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

/**
 * The binding every activity in this deployment belongs to. Hutchrok is the
 * only tenant today; this is the single place a second portfolio company
 * would be resolved from the request instead of configuration.
 */
export const HUTCHROK_BINDING: TenantBinding = {
  tenantId: env('HUTCHROK_TENANT_ID', 'hutchrok-solutions-group'),
  companyId: env('HUTCHROK_COMPANY_ID', 'hutchrok-solutions-group'),
};

interface ActivityStores {
  receipts: ProviderReceiptStore;
  assignments: AssignmentStore;
  exceptions: ExceptionStore;
  schedules: ScheduleStore;
}

function buildStores(): { stores: ActivityStores; backend: 'postgres' | 'memory' } {
  if (isDatabaseConfigured()) {
    const db = getDb();
    return {
      backend: 'postgres',
      stores: {
        receipts: new PgProviderReceiptStore(db),
        assignments: new PgAssignmentStore(db),
        exceptions: new PgExceptionStore(db),
        schedules: new PgScheduleStore(db),
      },
    };
  }

  console.warn(
    '[activity] DATABASE_URL not set — using in-memory stores. Idempotency holds only within this process.'
  );
  return {
    backend: 'memory',
    stores: {
      receipts: new InMemoryProviderReceiptStore(),
      assignments: new InMemoryAssignmentStore(),
      exceptions: new InMemoryExceptionStore(),
      schedules: new InMemoryScheduleStore(),
    },
  };
}

const built = buildStores();

export const activityBackend = built.backend;

export const receipts = new ProviderReceiptService(built.stores.receipts);
export const assignments = new AssignmentService(built.stores.assignments);
export const exceptions = new ExceptionQueue(built.stores.exceptions);
export const schedules = new ScheduleService(built.stores.schedules, {
  leaseMs: Number(env('ACTIVITY_LEASE_MS', '60000')),
});

/** How old a signed delivery may be before we treat it as a replay attempt. */
export const REPLAY_WINDOW_MS = Number(env('WEBHOOK_REPLAY_WINDOW_MS', '300000'));
