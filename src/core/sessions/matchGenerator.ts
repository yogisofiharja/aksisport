import type { ActivityDetail, SessionParticipant } from '../api/types';

export type GeneratedMatch = {
  participantIds: string[]; // SessionParticipant.id, team order (first half = A, rest = B)
};

function participantIn(participant: SessionParticipant, ap: { userId?: string; guestName?: string }): boolean {
  return (
    (participant.userId != null && ap.userId === participant.userId) ||
    (participant.guestName != null && ap.guestName === participant.guestName)
  );
}

function playCount(participant: SessionParticipant, activities: ActivityDetail[]): number {
  return activities.filter((a) => a.participants.some((ap) => participantIn(participant, ap))).length;
}

function isBusy(participant: SessionParticipant, busyActivities: ActivityDetail[]): boolean {
  return busyActivities.some((a) => a.participants.some((ap) => participantIn(participant, ap)));
}

// Checked-in players not already in a queued or live activity — the pool
// the generator actually draws from. Exported so callers (e.g. an
// "N players sitting out" count, or detecting a new check-in the current
// queue doesn't cover yet) don't have to reimplement the same busy check.
export function availableToPlay(checkedIn: SessionParticipant[], busyActivities: ActivityDetail[]): SessionParticipant[] {
  return checkedIn.filter((p) => !isBusy(p, busyActivities));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Fewest-played-first, ties broken randomly, given each candidate's
// current play count (a plain Map, not recomputed from activities every
// call — generateFairRound updates it as it goes, so a batch of more
// matches than there are players still cycles through everyone fairly
// instead of stopping after one lap).
function orderByCount(candidates: SessionParticipant[], counts: Map<string, number>): SessionParticipant[] {
  const groups = new Map<number, SessionParticipant[]>();
  for (const p of candidates) {
    const count = counts.get(p.id) ?? 0;
    const group = groups.get(count) ?? [];
    group.push(p);
    groups.set(count, group);
  }
  return [...groups.keys()].sort((a, b) => a - b).flatMap((count) => shuffle(groups.get(count) ?? []));
}

// Generates up to `count` matches, `needed` players each, drawn from
// whoever's played fewest so far this Session — including matches already
// added within this same call, so requesting more matches than there are
// checked-in players is expected: players cycle through fairly rather
// than the batch stopping once each has had one turn. Returns fewer than
// `count` (possibly zero) only if there aren't enough available
// (checked-in, non-busy) players to fill even one match.
export function generateFairRound(
  checkedIn: SessionParticipant[],
  busyActivities: ActivityDetail[],
  activities: ActivityDetail[],
  needed: number,
  count: number
): GeneratedMatch[] {
  const available = availableToPlay(checkedIn, busyActivities);
  if (available.length < needed || count <= 0) return [];

  const runningCounts = new Map(available.map((p) => [p.id, playCount(p, activities)]));
  const matches: GeneratedMatch[] = [];
  for (let i = 0; i < count; i++) {
    const picked = orderByCount(available, runningCounts).slice(0, needed);
    matches.push({ participantIds: picked.map((p) => p.id) });
    for (const p of picked) {
      runningCounts.set(p.id, (runningCounts.get(p.id) ?? 0) + 1);
    }
  }
  return matches;
}

// A rough, adjustable starting point for "how many matches" — not a
// literal port of any other app's table, just a similar order of
// magnitude (~3.5 matches/hour, e.g. 4h -> 14, 2h -> 7) so the organizer
// isn't starting from zero. Always organizer-overridable in the UI.
export function suggestedMatchCount(durationMinutes: number | undefined): number {
  if (!durationMinutes) return 4;
  return Math.max(1, Math.round((durationMinutes / 60) * 3.5));
}
