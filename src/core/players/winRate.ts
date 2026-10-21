import type { PlayerSportActivity } from '../api/types';

// Win rate in whole percent: wins over decided matches (wins + losses).
// A draw is neither, so it doesn't count either way. null before any
// match is decided.
export function winRate(summary: Pick<PlayerSportActivity['summary'], 'wins' | 'losses'>): number | null {
  const decided = summary.wins + (summary.losses ?? 0);
  return decided > 0 ? Math.round((summary.wins / decided) * 100) : null;
}
