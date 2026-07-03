import { describe, expect, it } from 'vitest';
import {
  addPoint,
  createInitialState,
  endMatchNow,
  getPointLabel,
  MatchConfig,
  MatchState,
} from './scoring';

function createSingleConfig(deuceMode: MatchConfig['deuceMode']): MatchConfig {
  return {
    mode: 'single',
    deuceMode,
    matchFormat: { type: 'open' },
    players: [
      { id: 'A1', name: 'Alice', team: 'A' },
      { id: 'B1', name: 'Bob', team: 'B' },
    ],
    serviceOrderPlayerIds: ['A1', 'B1'],
  };
}

function createDoubleConfig(deuceMode: MatchConfig['deuceMode']): MatchConfig {
  return {
    mode: 'double',
    deuceMode,
    matchFormat: { type: 'open' },
    players: [
      { id: 'A1', name: 'A1', team: 'A' },
      { id: 'A2', name: 'A2', team: 'A' },
      { id: 'B1', name: 'B1', team: 'B' },
      { id: 'B2', name: 'B2', team: 'B' },
    ],
    serviceOrderPlayerIds: ['A1', 'B1', 'A2', 'B2'],
  };
}

function applyPoints(state: MatchState, sequence: Array<'A' | 'B'>): MatchState {
  return sequence.reduce((current, team) => addPoint(current, team), state);
}

describe('scoring engine', () => {
  it('finishes a standard game with two-point lead', () => {
    let state = createInitialState(createSingleConfig('standard'));

    state = applyPoints(state, ['A', 'A', 'A', 'A']);

    expect(state.games.A).toBe(1);
    expect(state.games.B).toBe(0);
    expect(state.points).toEqual({ A: 0, B: 0 });
  });

  it('shows deuce and advantage labels in standard mode', () => {
    let state = createInitialState(createSingleConfig('standard'));
    state = applyPoints(state, ['A', 'A', 'A', 'B', 'B', 'B']);

    expect(getPointLabel(state, 'A')).toBe('D');
    expect(getPointLabel(state, 'B')).toBe('D');

    state = addPoint(state, 'A');

    expect(getPointLabel(state, 'A')).toBe('AD');
    expect(getPointLabel(state, 'B')).toBe('-');
  });

  it('uses sudden death only after deuce happens again in single-deuce mode', () => {
    let state = createInitialState(createSingleConfig('singleDeuceSuddenDeath'));
    state = applyPoints(state, ['A', 'A', 'A', 'B', 'B', 'B']);

    // First deuce is still normal deuce/advantage flow.
    expect(getPointLabel(state, 'A')).toBe('D');
    expect(getPointLabel(state, 'B')).toBe('D');

    state = addPoint(state, 'A');
    expect(getPointLabel(state, 'A')).toBe('AD');

    // Deuce happens again, now the next point is sudden death.
    state = addPoint(state, 'B');
    expect(getPointLabel(state, 'A')).toBe('SD');
    expect(getPointLabel(state, 'B')).toBe('SD');

    state = addPoint(state, 'B');

    expect(state.games.B).toBe(1);
    expect(state.points).toEqual({ A: 0, B: 0 });
  });

  it('rotates server each completed game in doubles order', () => {
    let state = createInitialState(createDoubleConfig('standard'));

    expect(state.currentServerPlayerId).toBe('A1');

    state = applyPoints(state, ['A', 'A', 'A', 'A']);
    expect(state.currentServerPlayerId).toBe('B1');

    state = applyPoints(state, ['A', 'A', 'A', 'A']);
    expect(state.currentServerPlayerId).toBe('A2');

    state = applyPoints(state, ['A', 'A', 'A', 'A']);
    expect(state.currentServerPlayerId).toBe('B2');
  });

  it('starts from selected first server when order is rotated', () => {
    const config: MatchConfig = {
      mode: 'double',
      deuceMode: 'standard',
      matchFormat: { type: 'open' },
      players: [
        { id: 'A1', name: 'A1', team: 'A' },
        { id: 'A2', name: 'A2', team: 'A' },
        { id: 'B1', name: 'B1', team: 'B' },
        { id: 'B2', name: 'B2', team: 'B' },
      ],
      serviceOrderPlayerIds: ['B1', 'A2', 'B2', 'A1'],
    };

    const state = createInitialState(config);
    expect(state.currentServerPlayerId).toBe('B1');
  });

  it('ends match and decides winner from current score', () => {
    let state = createInitialState(createSingleConfig('standard'));
    state = applyPoints(state, ['A', 'A', 'A', 'A']);
    state = addPoint(state, 'B');

    state = endMatchNow(state);

    expect(state.isEnded).toBe(true);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('manual');
  });

  it('ends match as draw if everything is tied', () => {
    const state = endMatchNow(createInitialState(createSingleConfig('standard')));

    expect(state.winner).toBeNull();
    expect(state.isEnded).toBe(true);
  });

  it('lets games accumulate past 6 without set completion in custom (open) format', () => {
    let state = createInitialState(createSingleConfig('standard'));

    // B wins 3 games, then A wins 6 — game count grows freely, no set is completed.
    for (let i = 0; i < 3; i++) state = applyPoints(state, ['B', 'B', 'B', 'B']);
    for (let i = 0; i < 6; i++) state = applyPoints(state, ['A', 'A', 'A', 'A']);

    expect(state.sets.A).toBe(0);
    expect(state.sets.B).toBe(0);
    expect(state.games).toEqual({ A: 6, B: 3 });
    expect(state.completedSets).toEqual([]);
  });

  it('prefers set count over game count when deciding manual winner', () => {
    let state = createInitialState(createSingleConfig('standard'));

    // Team B wins 1 set (6 games).
    for (let i = 0; i < 6; i++) {
      state = applyPoints(state, ['B', 'B', 'B', 'B']);
    }
    // Team A leads in games in the new set.
    state = applyPoints(state, ['A', 'A', 'A', 'A']);
    state = applyPoints(state, ['A', 'A', 'A', 'A']);

    state = endMatchNow(state);

    expect(state.winner).toBe('B');
  });
});

function createBestOfSetsConfig(setsToWin: number, superTiebreak = false): MatchConfig {
  return {
    mode: 'single',
    deuceMode: 'standard',
    matchFormat: { type: 'best-of-sets', setsToWin, superTiebreak },
    players: [
      { id: 'A1', name: 'Alice', team: 'A' },
      { id: 'B1', name: 'Bob', team: 'B' },
    ],
    serviceOrderPlayerIds: ['A1', 'B1'],
  };
}

function winGame(state: MatchState, team: Team): MatchState {
  return applyPoints(state, [team, team, team, team]);
}

function winGamesTo(state: MatchState, teamA: number, teamB: number): MatchState {
  // Interleave games to avoid triggering set win early
  const totalA = teamA;
  const totalB = teamB;
  let gA = 0;
  let gB = 0;
  while (gA < totalA || gB < totalB) {
    if (gA < totalA) { state = winGame(state, 'A'); gA++; }
    if (gB < totalB) { state = winGame(state, 'B'); gB++; }
  }
  return state;
}

describe('best-of-sets format', () => {
  it('requires 2-game lead to win a set (no set at 6-5)', () => {
    let state = createInitialState(createBestOfSetsConfig(2));
    state = winGamesTo(state, 6, 5);
    expect(state.sets.A).toBe(0);
    expect(state.sets.B).toBe(0);
    expect(state.games).toEqual({ A: 6, B: 5 });
    expect(state.tiebreak).toBeNull();
  });

  it('triggers tiebreak at 6-6', () => {
    let state = createInitialState(createBestOfSetsConfig(2));
    state = winGamesTo(state, 6, 6);
    expect(state.games).toEqual({ A: 6, B: 6 });
    expect(state.tiebreak).not.toBeNull();
    expect(state.tiebreak?.target).toBe(7);
  });

  it('tiebreak point labels are raw numbers', () => {
    let state = createInitialState(createBestOfSetsConfig(2));
    state = winGamesTo(state, 6, 6);
    expect(getPointLabel(state, 'A')).toBe('0');
    state = addPoint(state, 'A');
    expect(getPointLabel(state, 'A')).toBe('1');
    expect(getPointLabel(state, 'B')).toBe('0');
  });

  it('tiebreak win awards set 7-6 and resets games', () => {
    let state = createInitialState(createBestOfSetsConfig(2));
    state = winGamesTo(state, 6, 6);
    // Win tiebreak 7-0
    for (let i = 0; i < 7; i++) state = addPoint(state, 'A');
    expect(state.tiebreak).toBeNull();
    expect(state.sets.A).toBe(1);
    expect(state.games).toEqual({ A: 0, B: 0 });
    expect(state.completedSets).toEqual([{ A: 7, B: 6 }]);
  });

  it('auto-ends match when setsToWin sets are won', () => {
    let state = createInitialState(createBestOfSetsConfig(2));
    // Win set 1: 6-0
    for (let i = 0; i < 6; i++) state = winGame(state, 'A');
    expect(state.sets.A).toBe(1);
    expect(state.isEnded).toBe(false);
    // Win set 2: 6-0
    for (let i = 0; i < 6; i++) state = winGame(state, 'A');
    expect(state.sets.A).toBe(2);
    expect(state.isEnded).toBe(true);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('auto');
  });

  it('super tiebreak triggers at deciding sets level', () => {
    let state = createInitialState(createBestOfSetsConfig(2, true));
    // A wins set 1 (6-0), B wins set 2 (6-0)
    for (let i = 0; i < 6; i++) state = winGame(state, 'A');
    for (let i = 0; i < 6; i++) state = winGame(state, 'B');
    expect(state.sets).toEqual({ A: 1, B: 1 });
    expect(state.tiebreak).not.toBeNull();
    expect(state.tiebreak?.target).toBe(10);
  });

  it('super tiebreak win ends match', () => {
    let state = createInitialState(createBestOfSetsConfig(2, true));
    for (let i = 0; i < 6; i++) state = winGame(state, 'A');
    for (let i = 0; i < 6; i++) state = winGame(state, 'B');
    // Win super tiebreak 10-0
    for (let i = 0; i < 10; i++) state = addPoint(state, 'A');
    expect(state.isEnded).toBe(true);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('auto');
  });

  it('tiebreak service rotates: 1 serve then alternates every 2', () => {
    let state = createInitialState(createBestOfSetsConfig(2));
    state = winGamesTo(state, 6, 6);
    const firstServer = state.currentServerPlayerId;
    // After 1st tiebreak point, server should change
    state = addPoint(state, 'A');
    expect(state.currentServerPlayerId).not.toBe(firstServer);
    const secondServer = state.currentServerPlayerId;
    // After 2nd point, same server (no change)
    state = addPoint(state, 'A');
    expect(state.currentServerPlayerId).toBe(secondServer);
    // After 3rd point, change again
    state = addPoint(state, 'A');
    expect(state.currentServerPlayerId).not.toBe(secondServer);
  });
});
