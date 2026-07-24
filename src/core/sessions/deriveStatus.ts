import type { Session, SessionParticipant } from '../api/types';
import { getSportModule } from '../../sports/registry';

/**
 * DP-001: Session Lifecycle. Recruiting/Ready/Full are derived, not
 * stored — server only stores draft/open/in_progress/completed/cancelled
 * (see docs/engineering/architecture.md). This is the derivation, kept
 * client-side because it needs the Sport Engine's minParticipants rule,
 * which DP-003 deliberately keeps out of the server.
 */
export type DerivedSessionStatus =
  | 'draft'
  | 'recruiting'
  | 'ready'
  | 'full'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// "Joined" per DP-002: registered, checked_in, and checked_out all count
// toward headcount — only cancelled/no_show are excluded.
function countJoined(participants: SessionParticipant[]): number {
  return participants.filter(
    (p) => p.status === 'registered' || p.status === 'checked_in' || p.status === 'checked_out'
  ).length;
}

export function deriveSessionStatus(session: Session, participants: SessionParticipant[]): DerivedSessionStatus {
  // draft/in_progress/completed/cancelled pass through unchanged — only
  // 'open' has a derived sub-state.
  if (session.status !== 'open') {
    return session.status;
  }

  const joined = countJoined(participants);

  if (session.maxParticipants != null && joined >= session.maxParticipants) {
    return 'full';
  }

  // DP-001's "Minimum Participants" isn't defined at the session level —
  // DP-003 only defines it per match mode (Tennis Singles=2, Doubles=4).
  // Read as the sport's smallest mode minimum here — "enough people to
  // start playing something," not "enough for every possible match type."
  // Documented assumption, not stated explicitly in DP-001/DP-003.
  const sportModule = getSportModule(session.sport);
  const minParticipants = sportModule ? sportModule.rules.minParticipants('single') : 1;

  return joined >= minParticipants ? 'ready' : 'recruiting';
}
