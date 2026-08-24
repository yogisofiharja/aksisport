import type { Session } from '../api/types';
import { sessionDateBucket } from './sessionSchedule';

function isLiveSession(s: Session) {
  return s.status === 'in_progress';
}

function isDraftSession(s: Session) {
  return s.status === 'draft';
}

function byStartsAtAsc(a: Session, b: Session) {
  return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
}

export type CurrentFocusBuckets = {
  live: Session[];
  today: Session[];
  next: Session[];
  drafts: Session[];
};

// UX-015 (Consistent Mental Model): Personal Home and Community Home both
// present a "Current Focus" — the same ranking, Live, Today, the single
// soonest upcoming Session, then Drafts, so the two screens share one
// mental model instead of diverging ad hoc. Draft Sessions only ever show
// up here for an owner/admin caller — listSessions already excludes them
// server-side for a plain member (DP-001), so no extra client-side gating
// is needed to keep a member from seeing someone else's draft.
export function currentFocusBuckets(sessions: Session[]): CurrentFocusBuckets {
  const live = sessions.filter(isLiveSession);
  const today = sessions
    .filter((s) => !isLiveSession(s) && !isDraftSession(s) && sessionDateBucket(s) === 'today')
    .sort(byStartsAtAsc);
  const next = sessions
    .filter((s) => !isLiveSession(s) && !isDraftSession(s) && sessionDateBucket(s) === 'upcoming')
    .sort(byStartsAtAsc)
    .slice(0, 1);
  const drafts = sessions.filter(isDraftSession).sort(byStartsAtAsc);
  return { live, today, next, drafts };
}

export function currentFocusSessions(sessions: Session[]): Session[] {
  const { live, today, next, drafts } = currentFocusBuckets(sessions);
  return [...live, ...today, ...next, ...drafts];
}
