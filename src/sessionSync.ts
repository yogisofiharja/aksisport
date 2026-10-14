import { get, off, onValue, ref, remove, set } from 'firebase/database';
import { db } from './firebase';
import { TeamASide } from './appTypes';
import { MatchState } from './sports/tennis/scoringEngine';

// Live score for a Session match (ActivityMatchScreen): the scorer pushes
// every point to Firebase's Realtime Database and spectators subscribe.
// The completed result is stored on the server; this is only the live
// copy, cleared when the scorer moves on to the next match.
export type LiveMatchPayload = {
  matchState: MatchState | null;
  history: MatchState[];
  teamASide: TeamASide;
  updatedAt: number;
  activityId: string;
  scorerUid?: string;
};

// Keyed by activityId under `sessions/` — the only path the RTDB security
// rules allow (configured in the Firebase console, not version controlled
// — see docs/current/firebase-security.md; a dedicated `liveMatches/` path
// hit Permission_denied). The name is left over from the retired
// standalone scorer, whose 5-character session codes lived there too.
//
// Keying by activityId works because an Activity has at most one live
// match at a time. A future LiveSession entity (its own id and lifecycle)
// may replace this keying — not built now, just the seam.
function liveRef(activityId: string) {
  return db ? ref(db, `sessions/${activityId}`) : null;
}

export async function pushLiveMatchState(activityId: string, payload: LiveMatchPayload): Promise<void> {
  const r = liveRef(activityId);
  if (!r) return;
  try {
    await set(r, payload);
  } catch (err) {
    console.error('Live match push failed', err);
  }
}

export async function deleteLiveMatch(activityId: string): Promise<void> {
  const r = liveRef(activityId);
  if (!r) return;
  try {
    await remove(r);
  } catch {
    // ignore
  }
}

// One read of the live copy — a scorer reopening a match in progress
// picks up where they left off instead of starting from 0–0.
export async function readLiveMatch(activityId: string): Promise<LiveMatchPayload | null> {
  const r = liveRef(activityId);
  if (!r) return null;
  try {
    const snapshot = await get(r);
    return (snapshot.val() as LiveMatchPayload | null) ?? null;
  } catch {
    return null;
  }
}

export function subscribeToLiveMatch(activityId: string, callback: (payload: LiveMatchPayload | null) => void): () => void {
  const r = liveRef(activityId);
  if (!r) return () => {};
  onValue(r, (snapshot) => {
    callback((snapshot.val() as LiveMatchPayload | null) ?? null);
  });
  return () => off(r);
}
