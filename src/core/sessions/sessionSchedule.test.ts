import { describe, expect, it } from 'vitest';
import { sessionDateBucket } from './sessionSchedule';
import type { Session } from '../api/types';

function session(overrides: Partial<Session>): Session {
  return {
    id: 's1',
    clubId: 'c1',
    sport: 'tennis',
    courtCount: 1,
    status: 'open',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    hostPlaying: true,
    priceModel: 'free',
    joinedCount: 0,
    lifecycleStatus: 'recruiting',
    ...overrides,
  };
}

// All fixture timestamps pinned to noon UTC, shifted only by whole days —
// startOfDay() compares local calendar dates, so a "today" fixture must
// share NOW's exact timestamp (trivially same local day in any timezone)
// and "future"/"past" fixtures need a multi-day gap, not just a same-day
// hour offset, to stay unambiguous across timezones (a late-UTC-day
// timestamp can roll into the next local calendar day under a positive
// offset, and vice versa near UTC midnight with a negative one).
const NOW = new Date('2026-06-15T12:00:00Z');
const TODAY_STARTS_AT = '2026-06-15T12:00:00Z';
const FUTURE_STARTS_AT = '2026-06-20T12:00:00Z';
const PAST_STARTS_AT = '2026-06-10T12:00:00Z';

describe('sessionDateBucket', () => {
  it('buckets an open Session scheduled today as today', () => {
    expect(sessionDateBucket(session({ status: 'open', startsAt: TODAY_STARTS_AT }), NOW)).toBe('today');
  });

  it('buckets an in_progress Session scheduled today as today', () => {
    expect(sessionDateBucket(session({ status: 'in_progress', startsAt: TODAY_STARTS_AT }), NOW)).toBe('today');
  });

  it('buckets a future open Session as upcoming', () => {
    expect(sessionDateBucket(session({ status: 'open', startsAt: FUTURE_STARTS_AT }), NOW)).toBe('upcoming');
  });

  it('buckets a Session with no startsAt as upcoming', () => {
    expect(sessionDateBucket(session({ status: 'open', startsAt: undefined }), NOW)).toBe('upcoming');
  });

  // Milestone 2, revised: status now takes precedence over date — a
  // Completed/Cancelled Session always moves to "past", even if it was
  // scheduled for today or the future, so it stops showing in the active
  // Today/Upcoming list (SessionListScreen) and Home's attention section.
  it('buckets a cancelled Session scheduled today as past, not today', () => {
    expect(sessionDateBucket(session({ status: 'cancelled', startsAt: TODAY_STARTS_AT }), NOW)).toBe('past');
  });

  it('buckets a completed Session scheduled today as past, not today', () => {
    expect(sessionDateBucket(session({ status: 'completed', startsAt: TODAY_STARTS_AT }), NOW)).toBe('past');
  });

  it('buckets a cancelled Session scheduled in the future as past, not upcoming', () => {
    expect(sessionDateBucket(session({ status: 'cancelled', startsAt: FUTURE_STARTS_AT }), NOW)).toBe('past');
  });

  it('buckets a past-dated open Session as past', () => {
    expect(sessionDateBucket(session({ status: 'open', startsAt: PAST_STARTS_AT }), NOW)).toBe('past');
  });
});
