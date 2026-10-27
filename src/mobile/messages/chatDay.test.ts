import { describe, expect, it } from 'vitest';
import { chatDayKey, chatDayLabel } from './chatDay';

const now = new Date(2026, 9, 27, 20, 0); // Tue 27 Oct 2026
const t = (key: string) => key;

describe('chatDayLabel', () => {
  it('says today and yesterday', () => {
    expect(chatDayLabel(new Date(2026, 9, 27, 7, 30).toISOString(), 'en', t, now)).toBe('chatToday');
    expect(chatDayLabel(new Date(2026, 9, 26, 23, 0).toISOString(), 'en', t, now)).toBe('chatYesterday');
  });
  it('shows the weekday and date after that, with the year when it differs', () => {
    expect(chatDayLabel(new Date(2026, 9, 22, 9, 0).toISOString(), 'en', t, now)).toBe('Thu 22 Oct');
    expect(chatDayLabel(new Date(2025, 9, 22, 9, 0).toISOString(), 'en', t, now)).toBe('Wed 22 Oct 2025');
  });
});

describe('chatDayKey', () => {
  it('is the same for two times on one day', () => {
    expect(chatDayKey(new Date(2026, 9, 27, 1).toISOString())).toBe(chatDayKey(new Date(2026, 9, 27, 23).toISOString()));
  });
});
