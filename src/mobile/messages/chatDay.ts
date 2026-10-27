// The divider over a day's messages in a chat: "Today", "Yesterday", then
// the date ("Thu 22 Oct", "Kam 22 Okt"), with the year when it isn't this
// year.
export function chatDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function chatDayLabel(
  iso: string,
  lang: 'en' | 'id',
  t: (key: string) => string,
  now: Date = new Date()
): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return t('chatToday');
  if (days === 1) return t('chatYesterday');
  return d
    .toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    })
    .replace(/[.,]/g, '');
}
