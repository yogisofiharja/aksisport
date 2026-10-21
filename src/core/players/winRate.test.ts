import { describe, expect, it } from 'vitest';
import { winRate } from './winRate';

describe('winRate', () => {
  it('is wins over wins and losses', () => {
    expect(winRate({ wins: 14, losses: 9 })).toBe(61);
  });
  it('is null before any match is decided', () => {
    expect(winRate({ wins: 0, losses: 0 })).toBeNull();
  });
});
