import type { MatchState } from './scoringEngine';

type Team = 'A' | 'B';

// A finished tennis match's score as one line, from `team`'s side first:
// the sets ("6-4 3-6 7-5"), or — for a match ended before any set was
// complete — the games ("4-2"). Undefined when the stored result can't be
// read.
export function formatTennisResult(result: unknown, team: Team): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const state = result as Partial<MatchState>;
  const other: Team = team === 'A' ? 'B' : 'A';
  const sets = state.completedSets ?? [];
  if (sets.length > 0) {
    return sets.map((s) => `${s[team]}-${s[other]}`).join(' ');
  }
  if (state.games) return `${state.games[team]}-${state.games[other]}`;
  return undefined;
}
