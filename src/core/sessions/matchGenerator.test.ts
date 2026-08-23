import { describe, expect, it } from 'vitest';
import { generateFairRound } from './matchGenerator';
import type { ActivityDetail, SessionParticipant } from '../api/types';

function participant(id: string): SessionParticipant {
  return {
    id,
    sessionId: 's1',
    userId: id,
    status: 'checked_in',
    joinedAt: '2026-01-01T00:00:00Z',
    hasReceipt: false,
  };
}

// Minimal completed-match fixture — generateFairRound only reads
// createdAt (for chronological ordering) and participants (for play
// count / last-played lookups), so everything else is a placeholder.
function playedMatch(id: string, createdAt: string, participantIds: string[]): ActivityDetail {
  return {
    id,
    sessionId: 's1',
    sport: 'tennis',
    activityType: 'single',
    status: 'completed',
    config: {},
    pointLog: [],
    createdBy: 'u1',
    createdAt,
    participants: participantIds.map((pid, i) => ({
      id: `${id}-${pid}`,
      activityId: id,
      userId: pid,
      team: i === 0 ? 'A' : 'B',
      slotOrder: i,
    })),
  };
}

describe('generateFairRound', () => {
  it('alternates the two pairs across a batch, keeping both play count and waiting time even', () => {
    const players = ['a', 'b', 'c', 'd'].map(participant);
    const round = generateFairRound(players, [], [], 2, 4);
    expect(round).toHaveLength(4);

    // Whichever pair plays a given match, the complementary pair must
    // play the next one — anything else means a fewest-played tie was
    // broken by pure luck instead of by who'd waited longer, which is
    // exactly the "match count fair, waiting time not" complaint this
    // tiebreak exists to fix.
    for (let i = 0; i < round.length - 1; i++) {
      const current = new Set(round[i].participantIds);
      const overlap = round[i + 1].participantIds.filter((id) => current.has(id));
      expect(overlap).toHaveLength(0);
    }
  });

  it('prioritizes whoever has waited longest among candidates tied on play count', () => {
    // b and c are both on their 1st match so far (tied on count) — b's
    // was earlier (index 0), c's was more recent (index 1), so b has
    // been waiting longer since. a has already played twice, so a is
    // excluded by the count rule alone regardless of the tiebreak.
    const activities = [
      playedMatch('m0', '2026-01-01T00:00:00Z', ['a', 'b']),
      playedMatch('m1', '2026-01-01T00:05:00Z', ['a', 'c']),
    ];
    const players = ['a', 'b', 'c', 'd'].map(participant);
    // d has never played (count 0) so it's picked outright; the second
    // seat is the real test — must go to b (waited longer), not c.
    const round = generateFairRound(players, [], activities, 2, 1);
    expect(round).toHaveLength(1);
    expect(new Set(round[0].participantIds)).toEqual(new Set(['d', 'b']));
  });

  it('still returns nothing when there are fewer eligible players than a match needs', () => {
    const players = ['a'].map(participant);
    expect(generateFairRound(players, [], [], 2, 3)).toEqual([]);
  });
});
