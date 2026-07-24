import type { ActivityDetail, SessionParticipant } from '../api/types';
import type { MatchMode } from '../../sports/tennis/scoringEngine';
import { getSportModule } from '../../sports/registry';

/**
 * DP-005: Scheduler Architecture. "Suggest the next match. Explain why.
 * Never force organizer decisions." — this produces a suggestion only;
 * the organizer reviews, adjusts, and confirms through the same
 * AddMatchScreen participant-picker that already exists, unchanged.
 *
 * `reason` is a translation key, not display text — per coding-standards.md,
 * user-facing strings go through t() at the call site, not baked in here.
 */
export type MatchSuggestion = {
  participantIds: string[]; // SessionParticipant.id, in team order (first half = A, rest = B)
  reason: string;
};

export interface SchedulingPolicy {
  suggestNextMatch(params: {
    checkedIn: SessionParticipant[];
    busyActivities: ActivityDetail[];
    sport: string;
    mode: MatchMode;
  }): MatchSuggestion | null;
}

function isBusy(participant: SessionParticipant, busyActivities: ActivityDetail[]): boolean {
  return busyActivities.some((a) =>
    a.participants.some(
      (ap) =>
        (participant.userId != null && ap.userId === participant.userId) ||
        (participant.guestName != null && ap.guestName === participant.guestName)
    )
  );
}

/**
 * The only implementation for now. "A simple implementation is
 * acceptable... First checked-in players. Do NOT implement fairness or AI
 * yet." — no play-count weighting, no rotation fairness, deliberately.
 */
export const firstCheckedInPolicy: SchedulingPolicy = {
  suggestNextMatch({ checkedIn, busyActivities, sport, mode }) {
    const sportModule = getSportModule(sport);
    const needed = sportModule ? sportModule.rules.minParticipants(mode) : 2;

    const available = checkedIn
      .filter((p) => !isBusy(p, busyActivities))
      .sort((a, b) => (a.checkedInAt ?? '').localeCompare(b.checkedInAt ?? ''));

    if (available.length < needed) {
      return null;
    }

    return {
      participantIds: available.slice(0, needed).map((p) => p.id),
      reason: 'schedulerReasonEarliestCheckedIn',
    };
  },
};

export const defaultSchedulingPolicy = firstCheckedInPolicy;
