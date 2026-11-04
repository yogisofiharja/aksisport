import { describe, expect, it, vi } from 'vitest';

// The hook's module pulls in Firebase; only the pure helper is under test.
vi.mock('../../sessionSync', () => ({ subscribeToLiveMatch: () => () => {} }));

import { liveSideScores } from './liveScore';
import { addPoint, createInitialState, endMatchNow, type MatchConfig } from '../../sports/tennis/scoringEngine';

const config: MatchConfig = {
  mode: 'single',
  deuceMode: 'standard',
  matchFormat: { type: 'open' },
  players: [
    { id: 'A1', name: 'Alice', team: 'A' },
    { id: 'B1', name: 'Bob', team: 'B' },
  ],
  serviceOrderPlayerIds: ['A1', 'B1'],
};

describe('liveSideScores', () => {
  it('reads games, points and the server', () => {
    let state = createInitialState(config);
    state = addPoint(addPoint(state, 'A'), 'A');
    expect(liveSideScores(state)).toEqual({
      A: { games: 0, points: '30', serving: true },
      B: { games: 0, points: '0', serving: false },
    });
  });

  it('counts a won game and moves the serve', () => {
    let state = createInitialState(config);
    for (let i = 0; i < 4; i++) state = addPoint(state, 'A');
    expect(liveSideScores(state)).toEqual({
      A: { games: 1, points: '0', serving: false },
      B: { games: 0, points: '0', serving: true },
    });
  });

  it('has nothing before a push or once the match has ended', () => {
    expect(liveSideScores(null)).toBeUndefined();
    expect(liveSideScores(endMatchNow(createInitialState(config)))).toBeUndefined();
  });
});
