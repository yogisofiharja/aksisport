import { describe, expect, it } from 'vitest';
import { paymentStatus } from './paymentStatus';
import type { SessionParticipant } from '../api/types';

const priced = { priceModel: 'per_person' as const, createdBy: 'host' };
const player = (over: Partial<SessionParticipant>): SessionParticipant => ({
  id: 'p',
  sessionId: 's',
  status: 'registered',
  joinedAt: '2026-10-21T00:00:00Z',
  hasReceipt: false,
  ...over,
});

describe('paymentStatus', () => {
  it('is paid or awaiting for a member who went through approval', () => {
    expect(paymentStatus(player({ userId: 'u', status: 'waitlist' }), priced)).toBe('awaiting');
    expect(paymentStatus(player({ userId: 'u', status: 'checked_in' }), priced)).toBe('paid');
  });

  it('is undefined for the host, a guest, a requester and a free Session', () => {
    expect(paymentStatus(player({ userId: 'host' }), priced)).toBeUndefined();
    expect(paymentStatus(player({ guestName: 'Rafa' }), priced)).toBeUndefined();
    expect(paymentStatus(player({ userId: 'u', status: 'requested' }), priced)).toBeUndefined();
    expect(paymentStatus(player({ userId: 'u' }), { priceModel: 'free', createdBy: 'host' })).toBeUndefined();
  });
});
