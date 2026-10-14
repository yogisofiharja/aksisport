// What a group is called (DP-021): its name if it has one, otherwise the
// other members' names — up to three, then "+N".
export function groupLabel(title: string, otherNames: string[], otherCount: number): string {
  if (title.trim()) return title;
  const shown = otherNames.slice(0, 3);
  const extra = otherCount - shown.length;
  return shown.join(', ') + (extra > 0 ? ` +${extra}` : '');
}
