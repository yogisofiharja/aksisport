import { describe, expect, it } from 'vitest';
import { formatTennisResult } from './resultSummary';

describe('formatTennisResult', () => {
  const result = { completedSets: [{ A: 6, B: 4 }, { A: 3, B: 6 }], games: { A: 0, B: 0 } };

  it('lists the sets from the given team’s side', () => {
    expect(formatTennisResult(result, 'A')).toBe('6-4 3-6');
    expect(formatTennisResult(result, 'B')).toBe('4-6 6-3');
  });

  it('falls back to games when no set was completed', () => {
    expect(formatTennisResult({ completedSets: [], games: { A: 4, B: 2 } }, 'B')).toBe('2-4');
  });

  it('gives nothing for a result it cannot read', () => {
    expect(formatTennisResult(null, 'A')).toBeUndefined();
    expect(formatTennisResult('x', 'A')).toBeUndefined();
  });
});
