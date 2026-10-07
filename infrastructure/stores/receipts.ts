/**
 * Hutchrok OS — Postgres provider receipt store
 *
 * The whole point of this adapter is one statement. `claim` must decide
 * "first sighting or replay" atomically, because two concurrent deliveries of
 * the same provider event that both read "not seen" will both act — a double
 * filing, a double send, a double charge.
 *
 * `INSERT ... ON CONFLICT DO UPDATE RETURNING *, (xmax = 0) AS inserted` does
 * it in a single round trip: Postgres serializes on the unique index, and
 * `xmax = 0` is true only for the row that was actually inserted.
 */

import { sql } from 'drizzle-orm';
import type {
  ProviderEventReceipt,
  ProviderReceiptStore,
  ReceiptClaim,
} from './types.js';
import {
  col,
  firstRow,
  toBool,
  toISO,
  toInt,
  toRecord,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

function mapReceipt(row: Row): ProviderEventReceipt {
  return {
    id: String(col(row, 'id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
    tenantId: String(col(row, 'tenant_id')),
    companyId: String(col(row, 'company_id')),
    provider: String(col(row, 'provider')),
    providerEventId: String(col(row, 'provider_event_id')),
    idempotencyKey: String(col(row, 'idempotency_key')),
    payloadHash: String(col(row, 'payload_hash')),
    signatureVerified: toBool(col(row, 'signature_verified')),
    receivedAt: toISO(col(row, 'received_at')),
    firstSeenAt: toISO(col(row, 'first_seen_at')),
    replayCount: toInt(col(row, 'replay_count')),
    ...(toStringOptional(col(row, 'activity_event_id')) !== undefined
      ? { activityEventId: String(col(row, 'activity_event_id')) }
      : {}),
    metadata: toRecord(col(row, 'metadata')),
  };
}

export class PgProviderReceiptStore implements ProviderReceiptStore {
  constructor(private readonly db: SqlExecutor) {}

  async claim(receipt: ProviderEventReceipt): Promise<ReceiptClaim> {
    const result = await this.db.execute(sql`
      INSERT INTO provider_event_receipts (
        id, tenant_id, company_id, provider, provider_event_id, idempotency_key,
        payload_hash, signature_verified, received_at, first_seen_at,
        replay_count, metadata, created_at, updated_at
      ) VALUES (
        ${receipt.id}, ${receipt.tenantId}, ${receipt.companyId}, ${receipt.provider},
        ${receipt.providerEventId}, ${receipt.idempotencyKey}, ${receipt.payloadHash},
        ${receipt.signatureVerified}, ${receipt.receivedAt}, ${receipt.firstSeenAt},
        0, ${JSON.stringify(receipt.metadata)}::jsonb, ${receipt.createdAt}, ${receipt.updatedAt}
      )
      ON CONFLICT (provider, provider_event_id) DO UPDATE
        SET replay_count = provider_event_receipts.replay_count + 1,
            received_at  = EXCLUDED.received_at,
            updated_at   = EXCLUDED.received_at
      RETURNING *, (xmax = 0) AS inserted
    `);

    const row = firstRow<Row>(result);
    if (!row) {
      throw new Error('Receipt claim returned no row; the upsert did not execute.');
    }

    return {
      status: toBool(col(row, 'inserted')) ? 'first_seen' : 'replay',
      receipt: mapReceipt(row),
    };
  }

  async findByKey(
    provider: string,
    providerEventId: string
  ): Promise<ProviderEventReceipt | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM provider_event_receipts
      WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
    `);
    const row = firstRow<Row>(result);
    return row ? mapReceipt(row) : null;
  }

  async linkActivity(receiptId: string, activityEventId: string): Promise<void> {
    const result = await this.db.execute(sql`
      UPDATE provider_event_receipts
      SET activity_event_id = ${activityEventId}, updated_at = now()
      WHERE id = ${receiptId}
      RETURNING id
    `);
    if (!firstRow<Row>(result)) {
      throw new Error(`No receipt ${receiptId}.`);
    }
  }
}
