import type { SessionParticipant } from '../api/types';
import type { GeneratedMatch } from '../sessions/matchGenerator';
import type { ActivityParticipantInput } from './api';
import type { MatchConfig, MatchFormat, MatchMode, Player, Team } from '../../sports/tennis/scoringEngine';

export function participantLabel(p: SessionParticipant): string {
  return p.displayName || p.username || p.guestName || 'Player';
}

export function buildServiceOrder(players: Player[], firstServerId: string): string[] {
  const teamA = players.filter((p) => p.team === 'A');
  const teamB = players.filter((p) => p.team === 'B');
  const base: string[] = [];
  const maxCount = Math.max(teamA.length, teamB.length);
  for (let i = 0; i < maxCount; i++) {
    if (teamA[i]) base.push(teamA[i].id);
    if (teamB[i]) base.push(teamB[i].id);
  }
  const startIdx = base.indexOf(firstServerId);
  if (startIdx < 0) return base;
  return [...base.slice(startIdx), ...base.slice(0, startIdx)];
}

// Shared between AddMatchScreen's Generate Match/Matches and
// SessionDetailScreen's Regenerate — both need to turn a GeneratedMatch
// (just SessionParticipant ids) into a real createActivity payload.
export function buildGeneratedMatchPayload(
  matched: GeneratedMatch,
  mode: MatchMode,
  matchFormat: MatchFormat,
  singleDeuceSuddenDeath: boolean,
  checkedIn: SessionParticipant[]
): { config: MatchConfig; participants: ActivityParticipantInput[] } {
  const perTeam = mode === 'double' ? 2 : 1;
  const assigned = matched.participantIds.map((id) => checkedIn.find((p) => p.id === id)!);
  const players: Player[] = assigned.map((p, i) => ({
    id: p.id,
    name: participantLabel(p),
    team: (i < perTeam ? 'A' : 'B') as Team,
  }));
  const config: MatchConfig = {
    mode,
    deuceMode: singleDeuceSuddenDeath ? 'singleDeuceSuddenDeath' : 'standard',
    players,
    serviceOrderPlayerIds: buildServiceOrder(players, matched.participantIds[0]),
    matchFormat,
  };
  const participants: ActivityParticipantInput[] = assigned.map((p, i) => ({
    userId: p.userId,
    guestName: p.userId ? undefined : p.guestName,
    team: (i < perTeam ? 'A' : 'B') as Team,
  }));
  return { config, participants };
}
