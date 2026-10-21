import { describe, expect, it } from 'vitest';
import { playingNow, umpireStart } from './umpire';

const match = (id: string, status: 'queued' | 'live' | 'completed', users: string[]) => ({
  id,
  status,
  participants: users.map((u, i) => ({ id: `${id}-${i}`, activityId: id, slotOrder: i, userId: u })),
});

describe('umpireStart', () => {
  it('starts their own match when it is next', () => {
    const activities = [match('a', 'queued', ['x', 'y']), match('b', 'queued', ['me', 'z'])];
    expect(umpireStart({ activities, participants: [], courtCount: 2, myUserId: 'me' })).toEqual({ kind: 'mine', activityId: 'b' });
  });

  it('otherwise starts the next queued match once a court is free', () => {
    const activities = [match('a', 'live', ['p', 'q']), match('b', 'queued', ['x', 'y'])];
    expect(umpireStart({ activities, participants: [], courtCount: 2, myUserId: 'me' })).toEqual({ kind: 'next', activityId: 'b' });
  });

  it('has nothing to start while every court is busy', () => {
    const activities = [match('a', 'live', ['p', 'q']), match('b', 'queued', ['x', 'y'])];
    expect(umpireStart({ activities, participants: [], courtCount: 1, myUserId: 'me' })).toBeUndefined();
  });

  it('has nothing to start while they are playing and nothing is queued', () => {
    expect(umpireStart({ activities: [match('a', 'live', ['me', 'q'])], participants: [], courtCount: 2, myUserId: 'me' })).toBeUndefined();
  });
});

describe('playingNow', () => {
  it('is everyone in a live match', () => {
    const ids = playingNow([match('a', 'live', ['p', 'q']), match('b', 'queued', ['x']), match('c', 'completed', ['y'])]);
    expect([...ids].sort()).toEqual(['p', 'q']);
  });
});
