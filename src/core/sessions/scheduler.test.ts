import { describe, expect, it } from 'vitest';
import { firstCheckedInPolicy } from './scheduler';
import type { ActivityDetail, SessionParticipant } from '../api/types';

function participant(id: string, checkedInAt: string, userId = id): SessionParticipant {
  return {
    id,
    sessionId: 's1',
    userId,
    status: 'checked_in',
    checkedInAt,
    joinedAt: checkedInAt,
    hasReceipt: false,
  };
}

function busyActivity(userId: string): ActivityDetail {
  return {
    id: 'a1',
    sessionId: 's1',
    sport: 'tennis',
    activityType: 'match',
    status: 'queued',
    config: {},
    pointLog: [],
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    participants: [{ id: 'ap1', activityId: 'a1', userId, slotOrder: 0 }],
  };
}

describe('firstCheckedInPolicy', () => {
  it('suggests the earliest-checked-in players first, for singles', () => {
    const checkedIn = [
      participant('p3', '2026-01-01T10:02:00Z'),
      participant('p1', '2026-01-01T10:00:00Z'),
      participant('p2', '2026-01-01T10:01:00Z'),
    ];
    const suggestion = firstCheckedInPolicy.suggestNextMatch({
      checkedIn,
      busyActivities: [],
      sport: 'tennis',
      mode: 'single',
    });
    expect(suggestion?.participantIds).toEqual(['p1', 'p2']);
    expect(suggestion?.reason).toBe('schedulerReasonEarliestCheckedIn');
  });

  it('requires 4 for doubles', () => {
    const checkedIn = [
      participant('p1', '2026-01-01T10:00:00Z'),
      participant('p2', '2026-01-01T10:01:00Z'),
      participant('p3', '2026-01-01T10:02:00Z'),
    ];
    expect(
      firstCheckedInPolicy.suggestNextMatch({ checkedIn, busyActivities: [], sport: 'tennis', mode: 'double' })
    ).toBeNull();

    checkedIn.push(participant('p4', '2026-01-01T10:03:00Z'));
    const suggestion = firstCheckedInPolicy.suggestNextMatch({
      checkedIn,
      busyActivities: [],
      sport: 'tennis',
      mode: 'double',
    });
    expect(suggestion?.participantIds).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('excludes participants already in a queued or live activity', () => {
    const checkedIn = [
      participant('p1', '2026-01-01T10:00:00Z', 'u1'),
      participant('p2', '2026-01-01T10:01:00Z', 'u2'),
    ];
    const suggestion = firstCheckedInPolicy.suggestNextMatch({
      checkedIn,
      busyActivities: [busyActivity('u1')],
      sport: 'tennis',
      mode: 'single',
    });
    // p1 is busy; only p2 remains, below the minimum of 2 for singles.
    expect(suggestion).toBeNull();
  });

  it('returns null when there are no checked-in participants at all', () => {
    expect(
      firstCheckedInPolicy.suggestNextMatch({ checkedIn: [], busyActivities: [], sport: 'tennis', mode: 'single' })
    ).toBeNull();
  });
});
