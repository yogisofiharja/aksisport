import { describe, expect, it } from 'vitest';
import { notificationText, startsIn, timeAgo } from './text';

const t = (key: string, ...args: unknown[]) => `${key}(${args.join(',')})`;

describe('notificationText', () => {
  it('fills a community join request with the person and the community', () => {
    const text = notificationText(
      { id: '1', type: 'community_join_request', params: { name: 'Budi', club: 'Aksi Tennis' }, path: '/x', createdAt: '' },
      t
    );
    expect(text).toBe('notifCommunityJoinRequest(Budi,Aksi Tennis)');
  });

  it('fills each DP-018 step 2 kind', () => {
    const n = (type: string, params: Record<string, string>) => notificationText({ id: '1', type, params, path: '/', createdAt: '' }, t);
    expect(n('community_join_approved', { club: 'Aksi Tennis' })).toBe('notifCommunityJoinApproved(Aksi Tennis)');
    expect(n('session_join_request', { name: 'Budi', session: 'Sunday' })).toBe('notifSessionJoinRequest(Budi,Sunday)');
    expect(n('session_join_approved', { session: 'Sunday' })).toBe('notifSessionJoinApproved(Sunday)');
    expect(n('session_join_approved', { session: 'Sunday', claimed: '1' })).toBe('notifSessionJoinApprovedFree(Sunday)');
    expect(n('payment_receipt', { name: 'Budi', session: 'Sunday' })).toBe('notifPaymentReceipt(Budi,Sunday)');
    expect(n('payment_confirmed', { session: 'Sunday' })).toBe('notifPaymentConfirmed(Sunday)');
    expect(n('session_reminder', { session: 'Sunday', minutes: '120' })).toBe('notifSessionReminder(Sunday,startsIn(durationHours(2)))');
    expect(n('umpire_assigned', { session: 'Sunday' })).toBe('notifUmpireAssigned(Sunday)');
    expect(n('community_invite', { name: 'Budi', club: 'Senayan TC' })).toBe('notifInvited(Budi,Senayan TC)');
    expect(n('session_invite', { name: 'Budi', session: 'Sabtu' })).toBe('notifInvited(Budi,Sabtu)');
  });

  it('still says something for a type this version does not know', () => {
    expect(notificationText({ id: '1', type: 'from_the_future', params: {}, path: '/', createdAt: '' }, t)).toBe('notifGeneric()');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('rounds down to the largest whole unit', () => {
    expect(timeAgo('2026-10-14T11:59:30Z', t, 'en', now)).toBe('timeJustNow()');
    expect(timeAgo('2026-10-14T11:55:00Z', t, 'en', now)).toBe('timeMinutesAgo(5)');
    expect(timeAgo('2026-10-14T09:10:00Z', t, 'en', now)).toBe('timeHoursAgo(2)');
    expect(timeAgo('2026-10-12T12:00:00Z', t, 'en', now)).toBe('timeDaysAgo(2)');
  });
  it('shows the day and month after a week, and the year when it differs', () => {
    expect(timeAgo('2026-10-01T12:00:00Z', t, 'en', now)).toBe('1 Oct');
    expect(timeAgo('2025-10-14T12:00:00Z', t, 'en', now)).toBe('14 Oct 2025');
    expect(timeAgo('2026-08-17T12:00:00Z', t, 'id', now)).toBe('17 Agu');
  });
});

describe('startsIn', () => {
  it('says hours and minutes, never less than a minute', () => {
    expect(startsIn(120, t)).toBe('startsIn(durationHours(2))');
    expect(startsIn(90, t)).toBe('startsIn(durationHours(1) durationMinutes(30))');
    expect(startsIn(45, t)).toBe('startsIn(durationMinutes(45))');
    expect(startsIn(0, t)).toBe('startsIn(durationMinutes(1))');
    expect(startsIn(NaN, t)).toBe('startsIn(durationMinutes(1))');
  });
});
