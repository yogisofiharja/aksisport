import { describe, expect, it } from 'vitest';
import { courtCounts, playerStep } from './liveStrip';

const match = (id: string, status: 'queued' | 'live' | 'completed', users: string[]) => ({
  id,
  status,
  participants: users.map((u, i) => ({
    id: `${id}-${i}`,
    activityId: id,
    slotOrder: i,
    ...(u.startsWith('guest:') ? { guestName: u.slice(6) } : { userId: u }),
  })),
});

describe('playerStep', () => {
  it('is playing while in a live match', () => {
    expect(playerStep({ activities: [match('a', 'live', ['me', 'x'])], participants: [], courtCount: 2, myUserId: 'me' })).toEqual({
      kind: 'playing',
    });
  });

  it('is up next when their queued match fits a free court', () => {
    const activities = [match('a', 'live', ['x', 'y']), match('b', 'queued', ['me', 'z'])];
    expect(playerStep({ activities, participants: [], courtCount: 2, myUserId: 'me' })).toEqual({ kind: 'upNext', activityId: 'b' });
  });

  it('is up next without a court when theirs is first but every court is busy', () => {
    const activities = [match('a', 'live', ['x', 'y']), match('b', 'queued', ['me', 'z'])];
    expect(playerStep({ activities, participants: [], courtCount: 1, myUserId: 'me' })).toEqual({ kind: 'upNextNoCourt', activityId: 'b' });
  });

  it('is waiting when other matches are ahead', () => {
    const activities = [match('a', 'live', ['x', 'y']), match('b', 'queued', ['p', 'q']), match('c', 'queued', ['me', 'z'])];
    expect(playerStep({ activities, participants: [], courtCount: 2, myUserId: 'me' })).toEqual({ kind: 'waiting', activityId: 'c' });
  });

  it('is undefined with no match of theirs', () => {
    expect(playerStep({ activities: [match('a', 'queued', ['x', 'y'])], participants: [], courtCount: 1, myUserId: 'me' })).toBeUndefined();
  });
});

describe('courtCounts', () => {
  it('counts players on court, checked-in players off court, and free courts', () => {
    const activities = [match('a', 'live', ['u1', 'guest:Rafa']), match('b', 'queued', ['u2', 'u3'])];
    const participants = [
      { status: 'checked_in' as const, userId: 'u1' },
      { status: 'checked_in' as const, guestName: 'Rafa' },
      { status: 'checked_in' as const, userId: 'u2' },
      { status: 'checked_in' as const, userId: 'u3' },
      { status: 'registered' as const, userId: 'u4' },
    ];
    expect(courtCounts({ activities, participants, courtCount: 2 })).toEqual({ playing: 2, waiting: 2, courtsFree: 1 });
  });
});
