// Shared by every avatar-circle fallback (Club, Session organizer/
// participant, Club member, Home community grid) — first + last initials,
// used whenever hasAvatar is false and there's no picture to show instead.
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase();
}
