import { describe, expect, it } from 'vitest';
import { organizerToDo, paymentStatus, receiptToCheck, unpaidAfterStart } from './paymentStatus';
import type { SessionParticipant } from '../api/types';

const priced = { priceModel: 'per_person' as const, lifecycleStatus: 'recruiting' as const };
const started = { priceModel: 'per_person' as const, lifecycleStatus: 'completed' as const };
const player = (over: Partial<SessionParticipant>): SessionParticipant => ({
  id: 'p',
  sessionId: 's',
  status: 'registered',
  joinedAt: '2026-10-21T00:00:00Z',
  hasReceipt: false,
  paid: false,
  ...over,
});

describe('paymentStatus', () => {
  it('follows paid, not the place (DP-032)', () => {
    expect(paymentStatus(player({ userId: 'u', status: 'waitlist' }), priced)).toBe('awaiting');
    expect(paymentStatus(player({ userId: 'u', status: 'checked_in', paid: true }), priced)).toBe('paid');
    // Playing first, paying after.
    expect(paymentStatus(player({ userId: 'u', status: 'checked_in' }), priced)).toBe('awaiting');
  });

  it('applies to the host like anyone', () => {
    expect(paymentStatus(player({ userId: 'host' }), priced)).toBe('awaiting');
  });

  it('is undefined for a guest, a requester and a free Session', () => {
    expect(paymentStatus(player({ guestName: 'Rafa' }), priced)).toBeUndefined();
    expect(paymentStatus(player({ userId: 'u', status: 'requested' }), priced)).toBeUndefined();
    expect(paymentStatus(player({ userId: 'u' }), { priceModel: 'free' })).toBeUndefined();
  });
});

describe('receiptToCheck', () => {
  it('is an unpaid place with a receipt', () => {
    expect(receiptToCheck(player({ userId: 'u', status: 'waitlist', hasReceipt: true }), priced)).toBe(true);
    expect(receiptToCheck(player({ userId: 'u', status: 'checked_in', hasReceipt: true }), priced)).toBe(true);
    expect(receiptToCheck(player({ userId: 'u', status: 'waitlist' }), priced)).toBe(false);
    expect(receiptToCheck(player({ userId: 'u', status: 'registered', hasReceipt: true, paid: true }), priced)).toBe(false);
  });
});

describe('unpaidAfterStart', () => {
  it('counts a player who played and sent nothing, once started', () => {
    expect(unpaidAfterStart(player({ userId: 'u', status: 'checked_out' }), started)).toBe(true);
    expect(unpaidAfterStart(player({ userId: 'u', status: 'checked_out' }), priced)).toBe(false);
    expect(unpaidAfterStart(player({ userId: 'u', status: 'waitlist' }), started)).toBe(false);
    expect(unpaidAfterStart(player({ userId: 'u', status: 'checked_out', hasReceipt: true }), started)).toBe(false);
  });
});

describe('organizerToDo', () => {
  it('counts requests, receipts and unpaid players, and opens a request first', () => {
    const receipt = player({ id: 'r', userId: 'a', status: 'waitlist', hasReceipt: true });
    const request = player({ id: 'q', userId: 'b', status: 'requested' });
    const owing = player({ id: 'o', userId: 'c', status: 'checked_in' });
    const todo = organizerToDo([receipt, request, owing, player({ id: 'x', userId: 'd', status: 'waitlist' })], started);
    expect(todo).toEqual({ requests: 1, receipts: 1, unpaid: 1, first: request });
  });

  it('has nothing for a free Session with no requests', () => {
    const todo = organizerToDo([player({ userId: 'a', status: 'registered', hasReceipt: true })], { priceModel: 'free', lifecycleStatus: 'completed' });
    expect(todo).toEqual({ requests: 0, receipts: 0, unpaid: 0, first: undefined });
  });
});
