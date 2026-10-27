// When a new Recurring Schedule's first Session happens and when it opens
// for players (DP-007 v0.28.0: "First session: Sat 24 Oct, 07:00. It opens
// on Wed 21 Oct."). Mirrors the server (internal/scheduling): the first
// occurrence is the first <weekday> at <time> on or after the moment the
// Schedule is created, and each occurrence is generated — published —
// `leadDays` days before it, at the same time of day. An occurrence whose
// opening moment has already passed is generated straight away.
export function firstScheduledSession(
  weekday: number,
  hour: number,
  minute: number,
  leadDays: number,
  now: Date = new Date()
): { startsAt: Date; opensAt: Date; opensNow: boolean } {
  const startsAt = new Date(now);
  startsAt.setHours(hour, minute, 0, 0);
  while (startsAt.getDay() !== weekday || startsAt.getTime() < now.getTime()) {
    startsAt.setDate(startsAt.getDate() + 1);
    startsAt.setHours(hour, minute, 0, 0);
  }
  const opensAt = new Date(startsAt);
  opensAt.setDate(opensAt.getDate() - leadDays);
  return { startsAt, opensAt, opensNow: opensAt.getTime() <= now.getTime() };
}
