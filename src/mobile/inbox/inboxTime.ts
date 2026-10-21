// When a conversation was last active, as an Inbox row shows it: the time
// today, "Yesterday", the weekday within the last week, else the date.
export function inboxTime(at: string, lang: 'en' | 'id', yesterday: string, now: Date = new Date()): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (days === 1) return yesterday;
  if (days < 7) return d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '');
}
