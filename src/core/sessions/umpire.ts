import { courtsFree, playerStep } from './liveStrip';
import type { ActivityDetail, SessionParticipant } from '../api/types';

// DP-023: only the Session's umpire starts matches. Their bottom action is
// "Start my match" when their own match is next, otherwise "Start next
// match" — the first queued match, once a court is free.
export type UmpireStart = { kind: 'mine' | 'next'; activityId: string };

type Input = {
  activities: Pick<ActivityDetail, 'id' | 'status' | 'participants'>[];
  participants: Pick<SessionParticipant, 'status' | 'userId' | 'guestName'>[];
  courtCount: number;
  myUserId?: string;
};

export function umpireStart(input: Input): UmpireStart | undefined {
  const step = playerStep(input);
  if (step && step.kind !== 'playing') return { kind: 'mine', activityId: step.activityId };
  const next = input.activities.find((a) => a.status === 'queued');
  if (next && courtsFree(input.activities, input.courtCount) > 0) return { kind: 'next', activityId: next.id };
  return undefined;
}

// Whoever the live strip and the handover sheet call "Playing": in a live
// match right now. Everyone else checked in is sitting out.
export function playingNow(activities: Pick<ActivityDetail, 'status' | 'participants'>[]): Set<string> {
  const ids = new Set<string>();
  for (const a of activities) {
    if (a.status !== 'live') continue;
    for (const p of a.participants) if (p.userId) ids.add(p.userId);
  }
  return ids;
}
