import type { ActivityDetail, SessionParticipant } from '../api/types';
import { generateFairRound, participantIn, type GeneratedMatch } from './matchGenerator';

// DP-030: the organizer's "Now" panel while a Session is In Progress,
// computed from what the Session screen already loads.

// Waiting this long or more is highlighted.
export const LONG_WAIT_MINUTES = 30;

export type WaitingPlayer = {
  participant: SessionParticipant;
  // Since their last match ended, or since they checked in.
  minutes: number;
  long: boolean;
  // In a queued match already.
  queued: boolean;
};

export type OrganizerNow = {
  // Checked in, or on court in a live match.
  checkedIn: number;
  // Confirmed players: checked in, plus confirmed and not here yet.
  expected: number;
  notHere: SessionParticipant[];
  live: ActivityDetail[];
  courtsFree: number;
  waiting: WaitingPlayer[];
  nextQueued?: ActivityDetail;
  // Only when a court is free and nothing is queued: the fair scheduler's
  // pick (DP-005). The organizer adds it or not.
  suggestion?: GeneratedMatch;
};

const ENDED: ActivityDetail['status'][] = ['completed', 'unfinished'];

function byCreated(a: ActivityDetail, b: ActivityDetail) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function organizerNow({
  participants,
  activities,
  courtCount,
  needed,
  now = new Date(),
}: {
  participants: SessionParticipant[];
  activities: ActivityDetail[];
  courtCount: number;
  // Players a match needs (2 singles, 4 doubles).
  needed: number;
  now?: Date;
}): OrganizerNow {
  const live = activities.filter((a) => a.status === 'live').sort(byCreated);
  const queued = activities.filter((a) => a.status === 'queued').sort(byCreated);
  const ended = activities.filter((a) => ENDED.includes(a.status));
  const inMatch = (p: SessionParticipant, list: ActivityDetail[]) => list.some((a) => a.participants.some((ap) => participantIn(p, ap)));
  const checkedIn = participants.filter((p) => p.status === 'checked_in');
  const confirmed = participants.filter((p) => p.status === 'registered');
  // Someone on court is here, checked in or not (a match can start before
  // anyone checks in).
  const playingUnchecked = confirmed.filter((p) => inMatch(p, live));
  const notHere = confirmed.filter((p) => !inMatch(p, live));

  const waiting = checkedIn
    .filter((p) => !inMatch(p, live))
    .map((p) => {
      let since = p.checkedInAt ? new Date(p.checkedInAt).getTime() : now.getTime();
      for (const a of ended) {
        if (a.completedAt && a.participants.some((ap) => participantIn(p, ap))) {
          since = Math.max(since, new Date(a.completedAt).getTime());
        }
      }
      const minutes = Math.max(0, Math.floor((now.getTime() - since) / 60_000));
      return {
        participant: p,
        minutes,
        long: minutes >= LONG_WAIT_MINUTES,
        queued: inMatch(p, queued),
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const courtsFree = Math.max(0, courtCount - live.length);
  let suggestion: GeneratedMatch | undefined;
  if (courtsFree > 0 && queued.length === 0) {
    [suggestion] = generateFairRound(checkedIn, live, activities, needed, 1);
  }

  return {
    checkedIn: checkedIn.length + playingUnchecked.length,
    expected: checkedIn.length + confirmed.length,
    notHere,
    live,
    courtsFree,
    waiting,
    nextQueued: queued[0],
    suggestion,
  };
}
