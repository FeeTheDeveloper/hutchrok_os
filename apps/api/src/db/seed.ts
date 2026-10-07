/**
 * Hutchrok OS — Development seed (`pnpm db:seed`)
 *
 * Sample, obviously-fake data for local development only. Refuses to run
 * outside local/dev so it can never touch real customer records.
 *
 * Deliberately contains no credentials, no real veteran records, and nothing
 * classified RESTRICTED or SECRET.
 */

import { randomUUID } from 'crypto';

import { getDb, closeDb, schema } from './index.js';

const TENANT_ID = 'hutchrok-solutions-group';
const COMPANY_ID = 'hutchrok-solutions-group';

function assertSafeEnvironment(): void {
  const appEnv = process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'local';
  if (!['local', 'dev', 'test'].includes(appEnv)) {
    throw new Error(
      `Refusing to seed in "${appEnv}". The seed is local/dev only — it writes sample records.`
    );
  }
}

async function main(): Promise<void> {
  assertSafeEnvironment();
  const db = getDb();
  const now = new Date();

  const orgId = randomUUID();
  const personId = randomUUID();
  const contactPointId = randomUUID();

  console.log('[db:seed] inserting sample organization');
  await db
    .insert(schema.organizations)
    .values({
      id: orgId,
      legalName: 'Sample Veteran Holdings LLC',
      tradeName: 'Sample Veteran Holdings',
      entityType: 'LLC',
      stateOfFormation: 'TX',
      isActive: true,
      classification: 'INTERNAL',
      metadata: { seed: true },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  console.log('[db:seed] inserting sample person');
  await db
    .insert(schema.persons)
    .values({
      id: personId,
      firstName: 'Sample',
      lastName: 'Applicant',
      email: 'sample.applicant@example.invalid',
      isVeteran: true,
      veteranVerified: false,
      classification: 'INTERNAL',
      metadata: { seed: true },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  console.log('[db:seed] inserting sample contact point + consent');
  await db
    .insert(schema.contactPoints)
    .values({
      id: contactPointId,
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      kind: 'email',
      value: 'sample.applicant@example.invalid',
      personId,
      verified: false,
      classification: 'INTERNAL',
      metadata: { seed: true },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(schema.consentRecords)
    .values({
      id: randomUUID(),
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      contactPointId,
      channel: 'email',
      state: 'GRANTED',
      basis: 'web_form',
      capturedAt: now,
      source: 'seed',
      metadata: { seed: true },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  console.log('[db:seed] done');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('[db:seed] failed:', error instanceof Error ? error.message : error);
    await closeDb();
    process.exit(1);
  });
