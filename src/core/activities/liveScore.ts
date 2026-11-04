import { useEffect, useState } from 'react';
import { subscribeToLiveMatch, type LiveMatchPayload } from '../../sessionSync';
import { getPointLabel, getServerTeam, type MatchState } from '../../sports/tennis/scoringEngine';

export type LiveSideScore = { games: number; points: string; serving: boolean };

// One side's live score for a match card: games in the current set, the
// point ("15", "AD", or a tiebreak count) and whether it serves. Undefined
// before the first point is pushed, or once the match is over (its result
// takes over).
export function liveSideScores(state: MatchState | null | undefined): { A: LiveSideScore; B: LiveSideScore } | undefined {
  if (!state || state.isEnded) return undefined;
  const server = getServerTeam(state);
  const side = (team: 'A' | 'B'): LiveSideScore => ({
    games: state.games[team],
    points: getPointLabel(state, team),
    serving: server === team,
  });
  return { A: side('A'), B: side('B') };
}

// The live copies (RTDB, see sessionSync.ts) of the given matches, kept up
// to date while mounted — what a Session's Matches tab shows on its live
// cards. Keyed by activity id; a match with nothing pushed yet is absent.
export function useLiveMatchStates(activityIds: string[]): Record<string, MatchState> {
  const [states, setStates] = useState<Record<string, MatchState>>({});
  const key = [...activityIds].sort().join(',');
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    const unsubscribes = ids.map((id) =>
      subscribeToLiveMatch(id, (payload: LiveMatchPayload | null) => {
        setStates((prev) => {
          const next = { ...prev };
          if (payload?.matchState) next[id] = payload.matchState;
          else delete next[id];
          return next;
        });
      })
    );
    // Drop matches no longer live.
    setStates((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => ids.includes(id))));
    return () => unsubscribes.forEach((u) => u());
  }, [key]);
  return states;
}
