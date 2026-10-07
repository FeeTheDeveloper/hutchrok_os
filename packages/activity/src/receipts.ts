/**
 * Hutchrok OS — Provider Event Receipts
 *
 * Section 12: "Verify webhook signatures; enforce replay windows, provider
 * event IDs and idempotency keys."
 *
 * One receipt per (provider, providerEventId). The first delivery is
 * `first_seen` and may act. Every later delivery of the same provider event
 * is `replay` and must not act again, however many times it arrives.
 *
 * This is the single idempotency layer every ingestion path shares —
 * webhooks, polled mailboxes, and scheduled jobs alike. `claimKey` below
 * matches the shape `AutopilotStore.claimKey` already expects, so the
 * email lane can be backed by this store without a second mechanism.
 */

import { createHash } from 'crypto';
import { generateId, nowISO } from '@hutchrok-os/shared';
import type { ProviderEventReceipt, TenantBinding } from '@hutchrok-os/domain';

export type ClaimStatus = 'first_seen' | 'replay';

export interface ReceiptClaim {
  status: ClaimStatus;
  receipt: ProviderEventReceipt;
}

export interface ClaimInput extends TenantBinding {
  provider: string;
  providerEventId: string;
  /** Raw body, hashed for tamper evidence. Never stored. */
  rawBody: string;
  signatureVerified: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProviderReceiptStore {
  /**
   * Atomically record a first sighting or increment a replay.
   *
   * A persistent implementation MUST do this in one statement — e.g.
   * `INSERT ... ON CONFLICT (provider, provider_event_id) DO UPDATE SET
   * replay_count = receipts.replay_count + 1 RETURNING *, (xmax = 0) AS inserted`
   * — otherwise two concurrent deliveries can both read "not seen" and both act.
   */
  claim(receipt: ProviderEventReceipt): Promise<ReceiptClaim>;
  findByKey(provider: string, providerEventId: string): Promise<ProviderEventReceipt | null>;
  linkActivity(receiptId: string, activityEventId: string): Promise<void>;
}

export function hashPayload(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex');
}

export function idempotencyKeyFor(provider: string, providerEventId: string): string {
  return `${provider}:${providerEventId}`;
}

/**
 * True when `timestampISO` is recent enough to accept. Guards against a
 * captured-and-resent delivery long after the fact.
 */
export function isWithinReplayWindow(
  timestampISO: string,
  windowMs: number,
  nowMs: number = Date.now()
): boolean {
  const t = Date.parse(timestampISO);
  if (Number.isNaN(t)) return false;
  const age = nowMs - t;
  // Reject stale deliveries, and reject timestamps implausibly far in the
  // future (clock skew beyond the window is not something we accept).
  return age <= windowMs && age >= -windowMs;
}

export class ProviderReceiptService {
  constructor(private readonly store: ProviderReceiptStore) {}

  /**
   * Records the delivery and reports whether this caller may act on it.
   * Callers act only when `status === 'first_seen'`.
   */
  async claim(input: ClaimInput): Promise<ReceiptClaim> {
    if (!input.tenantId || !input.companyId) {
      throw new Error(
        'Cannot record a provider receipt without a resolved tenant/company binding.'
      );
    }

    const now = nowISO();
    const receipt: ProviderEventReceipt = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      tenantId: input.tenantId,
      companyId: input.companyId,
      provider: input.provider,
      providerEventId: input.providerEventId,
      idempotencyKey: idempotencyKeyFor(input.provider, input.providerEventId),
      payloadHash: hashPayload(input.rawBody),
      signatureVerified: input.signatureVerified,
      receivedAt: now,
      firstSeenAt: now,
      replayCount: 0,
      metadata: input.metadata ?? {},
    };

    return this.store.claim(receipt);
  }

  /** True the first time this key is seen. Mirrors `AutopilotStore.claimKey`. */
  async claimKey(key: string, binding: TenantBinding): Promise<boolean> {
    const [provider, ...rest] = key.split(':');
    const providerEventId = rest.join(':');
    if (!provider || !providerEventId) {
      throw new Error(`Malformed idempotency key "${key}" — expected "provider:eventId".`);
    }
    const claim = await this.claim({
      ...binding,
      provider,
      providerEventId,
      rawBody: key,
      signatureVerified: false,
    });
    return claim.status === 'first_seen';
  }

  async linkActivity(receiptId: string, activityEventId: string): Promise<void> {
    await this.store.linkActivity(receiptId, activityEventId);
  }

  /**
   * Binds this service to one tenant and exposes the single-argument
   * `claimKey` that the autopilot engine's `KeyClaimer` expects. Wiring this
   * in is what collapses the email/site lane's own dedupe onto the shared
   * provider-receipt table.
   */
  keyClaimerFor(binding: TenantBinding): { claimKey(key: string): Promise<boolean> } {
    return { claimKey: (key: string) => this.claimKey(key, binding) };
  }

  async find(provider: string, providerEventId: string): Promise<ProviderEventReceipt | null> {
    return this.store.findByKey(provider, providerEventId);
  }
}

// ─────────────────────────────────────────
// IN-MEMORY STORE (testing / dev)
// ─────────────────────────────────────────

export class InMemoryProviderReceiptStore implements ProviderReceiptStore {
  private byKey = new Map<string, ProviderEventReceipt>();
  private byId = new Map<string, ProviderEventReceipt>();

  async claim(receipt: ProviderEventReceipt): Promise<ReceiptClaim> {
    const existing = this.byKey.get(receipt.idempotencyKey);

    if (existing) {
      const updated: ProviderEventReceipt = {
        ...existing,
        replayCount: existing.replayCount + 1,
        receivedAt: receipt.receivedAt,
        updatedAt: receipt.receivedAt,
      };
      this.byKey.set(updated.idempotencyKey, updated);
      this.byId.set(updated.id, updated);
      return { status: 'replay', receipt: structuredClone(updated) };
    }

    this.byKey.set(receipt.idempotencyKey, receipt);
    this.byId.set(receipt.id, receipt);
    return { status: 'first_seen', receipt: structuredClone(receipt) };
  }

  async findByKey(provider: string, providerEventId: string): Promise<ProviderEventReceipt | null> {
    const found = this.byKey.get(idempotencyKeyFor(provider, providerEventId));
    return found ? structuredClone(found) : null;
  }

  async linkActivity(receiptId: string, activityEventId: string): Promise<void> {
    const existing = this.byId.get(receiptId);
    if (!existing) throw new Error(`No receipt ${receiptId}.`);
    const updated: ProviderEventReceipt = {
      ...existing,
      activityEventId,
      updatedAt: nowISO(),
    };
    this.byId.set(receiptId, updated);
    this.byKey.set(updated.idempotencyKey, updated);
  }

  all(): ProviderEventReceipt[] {
    return [...this.byId.values()].map((r) => structuredClone(r));
  }
}
