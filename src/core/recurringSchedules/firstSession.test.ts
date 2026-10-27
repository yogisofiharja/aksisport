import { describe, expect, it } from 'vitest';
import { firstScheduledSession } from './firstSession';

const SAT = 6;
// Tue 20 Oct 2026, 10:00 local.
const now = new Date(2026, 9, 20, 10, 0);

describe('firstScheduledSession', () => {
  it('finds the next weekday at that time and opens it days ahead', () => {
    const { startsAt, opensAt, opensNow } = firstScheduledSession(SAT, 7, 0, 3, now);
    expect(startsAt).toEqual(new Date(2026, 9, 24, 7, 0));
    expect(opensAt).toEqual(new Date(2026, 9, 21, 7, 0));
    expect(opensNow).toBe(false);
  });

  it('opens straight away when the opening moment has passed', () => {
    const { startsAt, opensNow } = firstScheduledSession(SAT, 7, 0, 5, now);
    expect(startsAt).toEqual(new Date(2026, 9, 24, 7, 0));
    expect(opensNow).toBe(true);
  });

  it('takes today when today is the weekday and the time is still ahead', () => {
    const { startsAt } = firstScheduledSession(2, 19, 0, 0, now);
    expect(startsAt).toEqual(new Date(2026, 9, 20, 19, 0));
  });

  it('moves to next week when today is the weekday but the time has passed', () => {
    const { startsAt } = firstScheduledSession(2, 7, 0, 3, now);
    expect(startsAt).toEqual(new Date(2026, 9, 27, 7, 0));
  });
});
