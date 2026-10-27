import { describe, expect, it } from 'vitest';
import { draftSessions, pastSessions, upcomingGroups } from './sessionGroups';
import type { Session } from '../api/types';

const now = new Date(2026, 9, 27, 10, 0); // Tue 27 Oct 2026, 10:00

function session(id: string, day: number, status: Session['status'] = 'open'): Session {
  return { id, status, startsAt: new Date(2026, 9, day, 19, 0).toISOString() } as Session;
}

describe('upcomingGroups', () => {
  it('splits today, the next seven days and later, leaving drafts out', () => {
    const g = upcomingGroups(
      [session('later', 5 + 31), session('today', 27), session('week', 29), session('edge', 3 + 31), session('draft', 28, 'draft')],
      now
    );
    expect(g.today.map((s) => s.id)).toEqual(['today']);
    expect(g.thisWeek.map((s) => s.id)).toEqual(['week', 'edge']);
    expect(g.later.map((s) => s.id)).toEqual(['later']);
  });
});

describe('pastSessions', () => {
  it('lists earlier and finished Sessions newest first, without drafts', () => {
    const past = pastSessions([session('a', 20), session('b', 25), session('done', 27, 'completed'), session('d', 21, 'draft')], now);
    expect(past.map((s) => s.id)).toEqual(['done', 'b', 'a']);
  });
});

describe('draftSessions', () => {
  it('keeps only drafts, soonest first', () => {
    expect(draftSessions([session('x', 30, 'draft'), session('y', 28, 'draft'), session('z', 28)]).map((s) => s.id)).toEqual(['y', 'x']);
  });
});
