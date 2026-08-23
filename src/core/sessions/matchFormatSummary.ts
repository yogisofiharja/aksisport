import type { MatchFormat } from '../../sports/tennis/scoringEngine';

// Match Setup's read-only format summary — shared by CreateSessionScreen's
// preview step and SessionDetailScreen's Configuration tab, so the two
// stay in sync rather than drifting apart as separate copies.
export function matchFormatSummary(format: MatchFormat, t: (key: string, ...args: unknown[]) => string): string {
  if (format.type === 'fixed-games') {
    return `${t('formatFixedGames')} · ${t('totalGames')}: ${format.totalGames}${format.goldenGameOnTie ? ` + ${t('goldenGame')}` : ''}`;
  }
  if (format.type === 'race-to') {
    return `${t('formatRaceTo')} · ${t('targetGames')}: ${format.raceTo}`;
  }
  if (format.type === 'best-of-sets') {
    return `${t('regularTab')} · ${t('setsToWin')}: ${format.setsToWin}${format.setsToWin > 1 && format.superTiebreak ? ` + ${t('superTiebreak')}` : ''}`;
  }
  return t('formatOpen');
}
