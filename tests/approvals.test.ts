/**
 * Tests: Approval System
 */

import { describe, it, expect } from 'vitest';
import { ApprovalService, InMemoryApprovalStore } from '../packages/approvals/src/index.js';
import { generateId } from '../packages/shared/src/index.js';

function createService() {
  const store = new InMemoryApprovalStore();
  const service = new ApprovalService(store);
  return { store, service };
}

describe('Approval System', () => {
  it('auto-approves Level A requests', async () => {
    const { service } = createService();
    const approval = await service.request({
      level: 'A',
      entityType: 'classification',
      entityId: generateId(),
    });
    expect(approval.status).toBe('AUTO_APPROVED');
  });

  it('creates PENDING approval for Level C', async () => {
    const { service } = createService();
    const approval = await service.request({
      level: 'C',
      entityType: 'filing_submission',
      entityId: generateId(),
    });
    expect(approval.status).toBe('PENDING');
  });

  it('creates PENDING approval for Level D', async () => {
    const { service } = createService();
    const approval = await service.request({
      level: 'D',
      entityType: 'bank_movement',
      entityId: generateId(),
    });
    expect(approval.status).toBe('PENDING');
  });

  it('approves a pending Level C approval', async () => {
    const { service } = createService();
    const approval = await service.request({
      level: 'C',
      entityType: 'filing_submission',
      entityId: generateId(),
    });

    const approved = await service.approve(approval.id, 'owner-user-id');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedByUserId).toBe('owner-user-id');
    expect(approved.resolvedAt).toBeTruthy();
  });

  it('rejects a pending approval', async () => {
    const { service } = createService();
    const approval = await service.request({
      level: 'C',
      entityType: 'contract',
      entityId: generateId(),
    });

    const rejected = await service.reject(approval.id, 'manager-id', 'Not ready yet');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reason).toBe('Not ready yet');
  });

  it('throws when approving already-resolved approval', async () => {
    const { service } = createService();
    const approval = await service.request({
      level: 'C',
      entityType: 'refund',
      entityId: generateId(),
    });

    await service.approve(approval.id, 'owner-id');

    await expect(service.approve(approval.id, 'owner-id')).rejects.toThrow('not in PENDING status');
  });

  it('retrieves pending approvals', async () => {
    const { service } = createService();

    await service.request({ level: 'C', entityType: 'filing_submission', entityId: generateId() });
    await service.request({ level: 'C', entityType: 'filing_submission', entityId: generateId() });
    await service.request({ level: 'A', entityType: 'classification', entityId: generateId() });

    const pending = await service.getPending({ level: 'C' });
    expect(pending.length).toBe(2);
  });
});
