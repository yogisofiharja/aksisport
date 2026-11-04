import { describe, expect, it } from 'vitest';
import { organizerNow } from './organizerNow';
import type { ActivityDetail, SessionParticipant } from '../api/types';

const NOW = new Date('2026-11-04T10:00:00Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const player = (id: string, status: SessionParticipant['status'], checkedInMinAgo?: number): SessionParticipant => ({
  id: `p-${id}`,
  sessionId: 's',
  userId: id,
  username: id,
  status,
  checkedInAt: checkedInMinAgo === undefined ? undefined : at(checkedInMinAgo),
  joinedAt: at(600),
  hasReceipt: false,
});

const match = (
  id: string,
  status: ActivityDetail['status'],
  users: string[],
  createdMinAgo: number,
  completedMinAgo?: number
): ActivityDetail =>
  ({
    id,
    sessionId: 's',
    sport: 'tennis',
    status,
    createdAt: at(createdMinAgo),
    completedAt: completedMinAgo === undefined ? undefined : at(completedMinAgo),
    participants: users.map((u, i) => ({
      userId: u,
      team: i < users.length / 2 ? 'A' : 'B',
    })),
  }) as unknown as ActivityDetail;

describe('organizerNow', () => {
  const participants = [
    player('a', 'checked_in', 90),
    player('b', 'checked_in', 90),
    player('c', 'checked_in', 60),
    player('d', 'checked_in', 10),
    player('e', 'registered'),
    player('f', 'requested'),
  ];

  it('counts who is here, courts and waits', () => {
    const now = organizerNow({
      participants,
      activities: [match('m1', 'completed', ['c', 'b'], 50, 5), match('m2', 'live', ['a', 'b'], 20)],
      courtCount: 2,
      needed: 2,
      now: NOW,
    });
    expect(now.checkedIn).toBe(4);
    expect(now.expected).toBe(5);
    expect(now.notHere.map((p) => p.userId)).toEqual(['e']);
    expect(now.live.map((a) => a.id)).toEqual(['m2']);
    expect(now.courtsFree).toBe(1);
    // c checked in 60 min ago but played until 5 min ago; d checked in 10 min ago.
    expect(now.waiting.map((w) => [w.participant.userId, w.minutes])).toEqual([
      ['d', 10],
      ['c', 5],
    ]);
    // A court is free and nothing is queued: suggest c vs d.
    expect(now.suggestion?.participantIds.sort()).toEqual(['p-c', 'p-d']);
  });

  it('highlights long waits and shows the queue instead of a suggestion', () => {
    const now = organizerNow({
      participants,
      activities: [match('m3', 'queued', ['a', 'c'], 5)],
      courtCount: 2,
      needed: 2,
      now: NOW,
    });
    expect(now.nextQueued?.id).toBe('m3');
    expect(now.suggestion).toBeUndefined();
    const a = now.waiting.find((w) => w.participant.userId === 'a')!;
    expect(a).toMatchObject({ minutes: 90, long: true, queued: true });
    const d = now.waiting.find((w) => w.participant.userId === 'd')!;
    expect(d).toMatchObject({ long: false, queued: false });
  });

  it('suggests nothing without a free court or enough players', () => {
    expect(
      organizerNow({
        participants,
        activities: [match('m2', 'live', ['a', 'b'], 20)],
        courtCount: 1,
        needed: 2,
        now: NOW,
      }).suggestion
    ).toBeUndefined();
    expect(
      organizerNow({
        participants: [player('a', 'checked_in', 5)],
        activities: [],
        courtCount: 2,
        needed: 2,
        now: NOW,
      }).suggestion
    ).toBeUndefined();
  });
});
