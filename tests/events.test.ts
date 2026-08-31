/**
 * Tests: Event System
 */

import { describe, it, expect } from 'vitest';
import { createEvent, EventEnvelopeSchema } from '../packages/events/src/index.js';

describe('Event System', () => {
  it('creates a valid event envelope', () => {
    const event = createEvent({
      event_type: 'customer.created',
      source: 'test',
      actor: 'test-user',
      entity_type: 'Customer',
      entity_id: '00000000-0000-0000-0000-000000000001',
      payload: { name: 'Test Customer' },
    });

    expect(event.event_id).toBeTruthy();
    expect(event.event_type).toBe('customer.created');
    expect(event.correlation_id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.business_id).toBe('hutchrok-solutions-group');
    expect(event.risk_level).toBe('LOW');
  });

  it('validates event envelope schema', () => {
    const validEvent = {
      event_id: '00000000-0000-0000-0000-000000000001',
      event_type: 'lead.created',
      business_id: 'hutchrok-solutions-group',
      source: 'website',
      actor: 'anonymous',
      timestamp: new Date().toISOString(),
      correlation_id: 'corr_abc123',
      payload: {},
      metadata: {},
      risk_level: 'LOW',
      schema_version: '1.0',
    };

    const result = EventEnvelopeSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('rejects invalid event envelope', () => {
    const invalid = {
      event_type: 'customer.created',
      // missing required fields
    };

    const result = EventEnvelopeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('uses provided correlation_id', () => {
    const event = createEvent({
      event_type: 'payment.completed',
      source: 'stripe',
      actor: 'stripe-webhook',
      correlation_id: 'corr_test123',
    });

    expect(event.correlation_id).toBe('corr_test123');
  });
});
