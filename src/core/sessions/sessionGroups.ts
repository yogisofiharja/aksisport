import type { Session } from '../api/types';
import { sessionDateBucket } from './sessionSchedule';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function byStartsAtAsc(a: Session, b: Session) {
  return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
}

export type UpcomingGroups = { today: Session[]; thisWeek: Session[]; later: Session[] };

// A Community's Sessions tab, Upcoming (Aksi redesign › Community ·
// Sessions): today's, the next seven days', then everything later, each
// soonest first. Drafts are left out — they have their own view.
export function upcomingGroups(sessions: Session[], now: Date = new Date()): UpcomingGroups {
  const weekEnd = startOfDay(now);
  weekEnd.setDate(weekEnd.getDate() + 8);
  const groups: UpcomingGroups = { today: [], thisWeek: [], later: [] };
  for (const s of [...sessions].sort(byStartsAtAsc)) {
    if (s.status === 'draft') continue;
    const bucket = sessionDateBucket(s, now);
    if (bucket === 'today') groups.today.push(s);
    else if (bucket === 'upcoming') {
      if (s.startsAt && new Date(s.startsAt) < weekEnd) groups.thisWeek.push(s);
      else groups.later.push(s);
    }
  }
  return groups;
}

// Past: every Session (any status but Draft) before today, newest first.
export function pastSessions(sessions: Session[], now: Date = new Date()): Session[] {
  return sessions
    .filter((s) => s.status !== 'draft' && sessionDateBucket(s, now) === 'past')
    .sort((a, b) => byStartsAtAsc(b, a));
}

// Drafts (owner/admin only; the server leaves them out for members), soonest first.
export function draftSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.status === 'draft').sort(byStartsAtAsc);
}
