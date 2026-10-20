import { describe, expect, it } from 'vitest';
import { buildMatchShareData } from './shareData';
import type { MatchState } from '../../sports/tennis/scoringEngine';

const state = (over: Partial<MatchState>) =>
  ({ sets: { A: 0, B: 0 }, games: { A: 4, B: 2 }, completedSets: [], winner: 'A', ...over }) as MatchState;

describe('buildMatchShareData', () => {
  it('shares players and the game score, with no session or format line', () => {
    const data = buildMatchShareData(state({}), { A: 'Budi / Andi', B: 'Sari / Tomi' });
    expect(data).toMatchObject({ matchup: 'Budi / Andi vs Sari / Tomi', score: '4 - 2', breakdown: undefined, winnerName: 'Budi / Andi' });
  });

  it('shares sets won with each set as the breakdown', () => {
    const data = buildMatchShareData(
      state({ sets: { A: 2, B: 1 }, completedSets: [{ A: 6, B: 4 }, { A: 3, B: 6 }, { A: 6, B: 2 }] as MatchState['completedSets'] }),
      { A: 'A', B: 'B' }
    );
    expect(data.score).toBe('2 - 1');
    expect(data.breakdown).toBe('6–4  ·  3–6  ·  6–2');
  });
});
