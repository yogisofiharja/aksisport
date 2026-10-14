import { describe, expect, it } from 'vitest';
import { notificationText, timeAgo } from './text';

const t = (key: string, ...args: unknown[]) => `${key}(${args.join(',')})`;

describe('notificationText', () => {
  it('fills a community join request with the person and the community', () => {
    const text = notificationText(
      { id: '1', type: 'community_join_request', params: { name: 'Budi', club: 'Aksi Tennis' }, path: '/x', createdAt: '' },
      t
    );
    expect(text).toBe('notifCommunityJoinRequest(Budi,Aksi Tennis)');
  });

  it('still says something for a type this version does not know', () => {
    expect(notificationText({ id: '1', type: 'from_the_future', params: {}, path: '/', createdAt: '' }, t)).toBe('notifGeneric()');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('rounds down to the largest whole unit', () => {
    expect(timeAgo('2026-10-14T11:59:30Z', t, now)).toBe('timeJustNow()');
    expect(timeAgo('2026-10-14T11:55:00Z', t, now)).toBe('timeMinutesAgo(5)');
    expect(timeAgo('2026-10-14T09:10:00Z', t, now)).toBe('timeHoursAgo(2)');
    expect(timeAgo('2026-10-12T12:00:00Z', t, now)).toBe('timeDaysAgo(2)');
  });
});
