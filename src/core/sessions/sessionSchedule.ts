import type { Session } from '../api/types';

export type SessionDateBucket = 'today' | 'upcoming' | 'past';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Buckets a Session for SessionListScreen ("Today"/"Upcoming") and
// SessionHistoryScreen ("Past"). Status takes precedence over date
// (Milestone 2, revised): a Completed or Cancelled Session always
// buckets as 'past', regardless of when it was scheduled — "Today"/
// "Upcoming" are for what's still active or hasn't happened yet, not a
// historical record. (Earlier behavior bucketed purely by calendar date,
// so a same-day Cancelled Session stayed in the active list — reversed
// per explicit product decision.) Otherwise, buckets by calendar date
// (not exact time) relative to today. Sessions with no startsAt (legacy,
// pre-DP-009-mandate) are treated as upcoming rather than silently
// hidden.
export function sessionDateBucket(session: Session, now: Date = new Date()): SessionDateBucket {
  if (session.status === 'completed' || session.status === 'cancelled') return 'past';
  if (!session.startsAt) return 'upcoming';
  const start = startOfDay(new Date(session.startsAt));
  const today = startOfDay(now);
  if (start.getTime() === today.getTime()) return 'today';
  return start.getTime() > today.getTime() ? 'upcoming' : 'past';
}

export function formatSessionDateTime(startsAt?: string): string | undefined {
  if (!startsAt) return undefined;
  const d = new Date(startsAt);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// Check-in (self, host-initiated, or adding a guest) is only allowed from
// 1 hour before the Session starts until it ends — an explicit product
// rule, mirrored server-side (checkInWindowOpen in sessions_handler.go)
// as the authoritative gate; this is for showing/hiding the UI affordance
// before the request even goes out. Sessions missing startsAt/duration
// (legacy, pre-DP-009) have no defined window — nothing restricted.
export function isWithinCheckInWindow(session: Session, now: Date = new Date()): boolean {
  if (!session.startsAt || session.durationMinutes == null) return true;
  const start = new Date(session.startsAt);
  const windowStart = new Date(start.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(start.getTime() + session.durationMinutes * 60 * 1000);
  return now >= windowStart && now < windowEnd;
}

// DP-011 — mirrors the server's sessionChatWindowOpen (sessions_handler.go),
// which is the actual gate on POST /sessions/:id/messages; this is only for
// the compose bar's enabled/disabled state, not enforcement. No lower
// bound — chat is open for the Session's entire life, including before it
// starts — only a week after it ends does it close to new messages.
export function isWithinChatWindow(session: Session, now: Date = new Date()): boolean {
  if (!session.startsAt || session.durationMinutes == null) return true;
  const start = new Date(session.startsAt);
  const windowEnd = new Date(start.getTime() + session.durationMinutes * 60 * 1000 + 7 * 24 * 60 * 60 * 1000);
  return now < windowEnd;
}
