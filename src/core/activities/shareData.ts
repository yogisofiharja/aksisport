import type { NativeShareData } from '../../components/NativeShareModal';
import type { MatchState } from '../../sports/tennis/scoringEngine';

type TeamNames = { A: string; B: string };

// What the share card (NativeShareModal / shareCardCanvas, DP-026) shows for
// a finished match: the players, the score, the set scores and the Aksi
// mark — nothing about the Session or its format. One builder for every
// place a match is shared from (Result saved, a match's result, a row in
// the Session's Results).
export function buildMatchShareData(state: MatchState, teamNames: TeamNames): NativeShareData {
  const hasSets = state.sets.A > 0 || state.sets.B > 0;
  const score = hasSets ? `${state.sets.A} - ${state.sets.B}` : `${state.games.A} - ${state.games.B}`;
  const breakdown = hasSets ? state.completedSets.map((s) => `${s.A}–${s.B}`).join('  ·  ') : undefined;
  const winnerName = state.winner === 'A' ? teamNames.A : state.winner === 'B' ? teamNames.B : undefined;
  return {
    matchup: `${teamNames.A} vs ${teamNames.B}`,
    score,
    breakdown,
    message: ['🎾 Aksi', `${teamNames.A} vs ${teamNames.B}`, score, breakdown ?? '', winnerName ? `${winnerName} menang` : '']
      .filter(Boolean)
      .join('\n'),
    winnerName,
  };
}

// A stored result's team names, from the players in its own config (the
// names as they were when the match was played).
export function teamNamesFromState(state: Pick<MatchState, 'config'>): TeamNames {
  const names = (team: 'A' | 'B') =>
    state.config.players
      .filter((p) => p.team === team)
      .map((p) => p.name)
      .join(' / ');
  return { A: names('A'), B: names('B') };
}
