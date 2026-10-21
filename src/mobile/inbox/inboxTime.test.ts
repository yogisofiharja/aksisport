import { describe, expect, it } from 'vitest';
import { inboxTime } from './inboxTime';

const now = new Date(2026, 9, 22, 20, 0); // Thu 22 Oct 2026, 20:00

describe('inboxTime', () => {
  it('shows the time for today', () => {
    expect(inboxTime(new Date(2026, 9, 22, 7, 41).toISOString(), 'en', 'Yesterday', now)).toBe('07:41');
  });
  it('says yesterday', () => {
    expect(inboxTime(new Date(2026, 9, 21, 23, 0).toISOString(), 'en', 'Yesterday', now)).toBe('Yesterday');
  });
  it('shows the weekday within a week', () => {
    expect(inboxTime(new Date(2026, 9, 16, 9, 0).toISOString(), 'en', 'Yesterday', now)).toBe('Fri');
  });
  it('shows the date after that', () => {
    expect(inboxTime(new Date(2026, 9, 1, 9, 0).toISOString(), 'en', 'Yesterday', now)).toBe('1 Oct');
  });
  it('is empty for a bad date', () => {
    expect(inboxTime('nope', 'en', 'Yesterday', now)).toBe('');
  });
});
