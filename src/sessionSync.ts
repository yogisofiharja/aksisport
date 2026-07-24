import { off, onValue, ref, remove, set } from 'firebase/database';
import { db } from './firebase';
import { TeamASide } from './appTypes';
import { MatchState } from './sports/tennis/scoringEngine';

export type SessionPayload = {
  // Optional: only the local-setup-scoped flow (ScoringFlow) sets these.
  // Activity-scoped matches (ActivityMatchScreen) omit them and set
  // activityId/scorerUid instead.
  setup?: import('./appTypes').SetupForm;
  matchState: MatchState | null;
  history: MatchState[];
  teamASide: TeamASide;
  playerPlayCounts?: Record<string, number>;
  updatedAt: number;
  activityId?: string;
  scorerUid?: string;
};

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSessionCode(): string {
  return Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export async function pushSessionState(code: string, payload: SessionPayload): Promise<void> {
  if (!db) return;
  try {
    await set(ref(db, `sessions/${code}`), payload);
  } catch (err) {
    console.error('Session push failed', err);
  }
}

export async function deleteSession(code: string): Promise<void> {
  if (!db) return;
  try {
    await remove(ref(db, `sessions/${code}`));
  } catch {
    // ignore
  }
}

export function subscribeToSession(
  code: string,
  callback: (payload: SessionPayload | null) => void,
): () => void {
  if (!db) return () => {};
  const sessionRef = ref(db, `sessions/${code}`);
  onValue(sessionRef, (snapshot) => {
    callback((snapshot.val() as SessionPayload | null) ?? null);
  });
  return () => off(sessionRef);
}

// ── Activity-scoped live matches (ActivityMatchScreen) ──────────────────────
//
// Keyed directly by activityId, reusing the same `sessions/` path as the
// legacy/web ScoringFlow above — not a separate top-level path. A dedicated
// `liveMatches/` path was tried first but hit Permission_denied: the actual
// RTDB security rules (configured in the Firebase console, not version
// controlled — see docs/current/firebase-security.md) only grant access
// under `sessions/`, and RTDB default-denies any path with no matching
// rule. Reusing `sessions/` sidesteps that without needing console access.
// activityId (a UUID) never collides with the random 5-character codes
// legacy sessions use, so both can safely share the same path.
//
// Using activityId as the key is still a Milestone 1 implementation
// shortcut, not the long-term domain model: it works because today an
// Activity has at most one live match at a time and no resumable "session"
// concept beyond the Activity itself. A future LiveSession entity (its own
// id, its own lifecycle independent of the Activity's) may replace this
// keying — do not build that now, this is just flagging the seam.

export async function pushLiveMatchState(activityId: string, payload: SessionPayload): Promise<void> {
  return pushSessionState(activityId, payload);
}

export async function deleteLiveMatch(activityId: string): Promise<void> {
  return deleteSession(activityId);
}

export function subscribeToLiveMatch(
  activityId: string,
  callback: (payload: SessionPayload | null) => void,
): () => void {
  return subscribeToSession(activityId, callback);
}
