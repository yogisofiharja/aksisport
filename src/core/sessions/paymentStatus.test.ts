import { describe, expect, it } from 'vitest';
import { organizerToDo, paymentStatus, receiptToCheck } from './paymentStatus';
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

describe('receiptToCheck', () => {
  it('is an awaited payment with a receipt', () => {
    expect(receiptToCheck(player({ userId: 'u', status: 'waitlist', hasReceipt: true }), priced)).toBe(true);
    expect(receiptToCheck(player({ userId: 'u', status: 'waitlist' }), priced)).toBe(false);
    expect(receiptToCheck(player({ userId: 'u', status: 'registered', hasReceipt: true }), priced)).toBe(false);
  });
});

describe('organizerToDo', () => {
  it('counts requests and receipts, and opens a request first', () => {
    const receipt = player({ id: 'r', userId: 'a', status: 'waitlist', hasReceipt: true });
    const request = player({ id: 'q', userId: 'b', status: 'requested' });
    const todo = organizerToDo([receipt, request, player({ id: 'x', userId: 'c', status: 'waitlist' })], priced);
    expect(todo).toEqual({ requests: 1, receipts: 1, first: request });
  });

  it('has nothing for a free Session with no requests', () => {
    const todo = organizerToDo([player({ userId: 'a', status: 'registered', hasReceipt: true })], { priceModel: 'free', createdBy: 'host' });
    expect(todo).toEqual({ requests: 0, receipts: 0, first: undefined });
  });
});
