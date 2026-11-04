// Shared by every avatar-circle fallback (Club, Session organizer/
// participant, Club member, Home community grid) — first + last initials,
// used whenever hasAvatar is false and there's no picture to show instead.
// Only letters and digits count: "[TEST] Walkthrough Tennis" is "TT",
// never "[T"; a word with neither ("—") is skipped.
export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((c): c is string => Boolean(c));
  const first = parts[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1] : '';
  return (first + second).toUpperCase();
}
