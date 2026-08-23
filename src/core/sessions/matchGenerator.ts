import type { ActivityDetail, SessionParticipant } from '../api/types';

// The "eligible" pool this module's functions draw from is any
// participant with a claimed spot — status 'registered' or 'checked_in'
// — not checked_in alone. Matches can be planned as soon as people have
// confirmed they're coming, before anyone's physically checked in; a
// match's own players still need to actually check in before they can
// self-start it (SessionDetailScreen's canStart), so nothing about
// starting a match changes here — this only widens when a match can be
// *planned*. Callers decide what counts as eligible and pass that array
// in; this module has no opinion on participant status itself.
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

// Eligible players (registered or checked_in — see module comment) not
// already in a queued or live activity — the pool the generator actually
// draws from. Exported so callers (e.g. an "N players sitting out" count,
// or detecting a new registration/check-in the current queue doesn't
// cover yet) don't have to reimplement the same busy check.
export function availableToPlay(eligible: SessionParticipant[], busyActivities: ActivityDetail[]): SessionParticipant[] {
  return eligible.filter((p) => !isBusy(p, busyActivities));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Chronological order of every match generated so far, regardless of
// status — the sequence itself, not wall-clock time, is what "how long
// has this player been waiting" is measured against. activities from the
// API isn't chronological (grouped live -> queued -> completed first),
// so this always re-sorts by createdAt rather than trusting array order.
function chronological(activities: ActivityDetail[]): ActivityDetail[] {
  return [...activities].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// The index (within `ordered`, chronological) of the most recent match a
// participant appeared in, or -1 if they've never played — used as a
// "waiting since" marker: a smaller index means they played longer ago
// (or never), so they're more overdue for a turn.
function lastPlayedIndex(participant: SessionParticipant, ordered: ActivityDetail[]): number {
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].participants.some((ap) => participantIn(participant, ap))) return i;
  }
  return -1;
}

// Fewest-played-first (primary), longest-waiting-first as the tiebreak
// (secondary — see module comment), any remaining tie broken randomly.
// counts/lastPlayed are plain Maps, not recomputed from activities every
// call — generateFairRound updates both as it goes, so a batch of more
// matches than there are players still cycles through everyone fairly
// (both in count *and* turn order) instead of stopping after one lap or
// randomly re-picking someone who just played.
function orderByFairness(
  candidates: SessionParticipant[],
  counts: Map<string, number>,
  lastPlayed: Map<string, number>
): SessionParticipant[] {
  const groups = new Map<string, SessionParticipant[]>();
  for (const p of candidates) {
    const key = `${counts.get(p.id) ?? 0}:${lastPlayed.get(p.id) ?? -1}`;
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  const sortedKeys = [...groups.keys()].sort((ka, kb) => {
    const [countA, lastA] = ka.split(':').map(Number);
    const [countB, lastB] = kb.split(':').map(Number);
    if (countA !== countB) return countA - countB;
    return lastA - lastB;
  });
  return sortedKeys.flatMap((key) => shuffle(groups.get(key) ?? []));
}

// Generates up to `count` matches, `needed` players each, drawn from
// whoever's played fewest so far this Session (primary) and, among ties,
// whoever's waited longest since their last match (secondary) — the two
// dimensions organizers actually feel: an even *number* of matches per
// player is not the same as an even *wait* between them. Ties broken
// randomly (also giving each regenerate a genuinely different shuffle,
// not just the same fair order every time). Includes matches already
// added within this same call, so requesting more matches than there are
// eligible players is expected: players cycle through fairly rather than
// the batch stopping once each has had one turn. Returns fewer than
// `count` (possibly zero) only if there aren't enough available
// (eligible, non-busy) players to fill even one match.
export function generateFairRound(
  eligible: SessionParticipant[],
  busyActivities: ActivityDetail[],
  activities: ActivityDetail[],
  needed: number,
  count: number
): GeneratedMatch[] {
  const available = availableToPlay(eligible, busyActivities);
  if (available.length < needed || count <= 0) return [];

  const ordered = chronological(activities);
  const runningCounts = new Map(available.map((p) => [p.id, playCount(p, activities)]));
  const runningLastPlayed = new Map(available.map((p) => [p.id, lastPlayedIndex(p, ordered)]));
  // Matches generated within this same batch continue the same sequence —
  // picking someone for match #1 of this batch makes them "just played"
  // for the purposes of ordering match #2, etc.
  let nextIndex = ordered.length;

  const matches: GeneratedMatch[] = [];
  for (let i = 0; i < count; i++) {
    const picked = orderByFairness(available, runningCounts, runningLastPlayed).slice(0, needed);
    matches.push({ participantIds: picked.map((p) => p.id) });
    for (const p of picked) {
      runningCounts.set(p.id, (runningCounts.get(p.id) ?? 0) + 1);
      runningLastPlayed.set(p.id, nextIndex);
    }
    nextIndex++;
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
