import type { ActivityDetail, SessionParticipant } from '../api/types';

// DP-024's live strip: while a Session is In Progress, one line under its
// header — the player's own next step, or for organizers the courts at a
// glance. Computed from what the Session screen already loads: its
// matches (activities), its players, and its court count. Matches carry no
// court number, so a free court is counted (court count minus live
// matches), never named.

export type PlayerStep =
  // In a live match right now.
  | { kind: 'playing' }
  // The next queued match that fits a free court is theirs.
  | { kind: 'upNext'; activityId: string }
  // Theirs is first in the queue, but every court is busy.
  | { kind: 'upNextNoCourt'; activityId: string }
  // Queued, but courts are busy or other matches are ahead.
  | { kind: 'waiting'; activityId: string };

export type CourtCounts = { playing: number; waiting: number; courtsFree: number };

type Input = {
  activities: Pick<ActivityDetail, 'id' | 'status' | 'participants'>[];
  participants: Pick<SessionParticipant, 'status' | 'userId' | 'guestName'>[];
  courtCount: number;
  myUserId?: string;
};

function liveAndQueued(activities: Input['activities']) {
  return {
    live: activities.filter((a) => a.status === 'live'),
    queued: activities.filter((a) => a.status === 'queued'),
  };
}

export function courtsFree(activities: Input['activities'], courtCount: number): number {
  return Math.max(0, courtCount - liveAndQueued(activities).live.length);
}

// The viewer's own step, or undefined when they are in no live or queued
// match (the strip then shows the court counts instead).
export function playerStep({ activities, courtCount, myUserId }: Input): PlayerStep | undefined {
  if (!myUserId) return undefined;
  const { live, queued } = liveAndQueued(activities);
  const mine = (a: Input['activities'][number]) => a.participants.some((p) => p.userId === myUserId);
  if (live.some(mine)) return { kind: 'playing' };
  const index = queued.findIndex(mine);
  if (index < 0) return undefined;
  const free = courtsFree(activities, courtCount);
  const activityId = queued[index].id;
  if (index < free) return { kind: 'upNext', activityId };
  if (index === 0) return { kind: 'upNextNoCourt', activityId };
  return { kind: 'waiting', activityId };
}

// A member by their account; a guest (no account) by name, the only thing
// a match's player row and a Session's player row share for them.
function personKey(p: { userId?: string; guestName?: string }): string {
  return p.userId ? `u:${p.userId}` : `g:${p.guestName ?? ''}`;
}

// Organizer view: players on court, checked-in players not on court, and
// courts with no live match.
export function courtCounts({ activities, participants, courtCount }: Input): CourtCounts {
  const { live } = liveAndQueued(activities);
  const onCourt = new Set<string>();
  for (const a of live) for (const p of a.participants) onCourt.add(personKey(p));
  const checkedIn = participants.filter((p) => p.status === 'checked_in');
  const waiting = checkedIn.filter((p) => !onCourt.has(personKey(p))).length;
  return { playing: onCourt.size, waiting, courtsFree: courtsFree(activities, courtCount) };
}
