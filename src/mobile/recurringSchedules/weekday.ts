// Shared across list/detail/create screens — 0=Sunday .. 6=Saturday,
// matching RecurrenceRule.weekday (DP-007).
const WEEKDAY_KEYS = [
  'recurringScheduleWeekdaySun',
  'recurringScheduleWeekdayMon',
  'recurringScheduleWeekdayTue',
  'recurringScheduleWeekdayWed',
  'recurringScheduleWeekdayThu',
  'recurringScheduleWeekdayFri',
  'recurringScheduleWeekdaySat',
] as const;

export function weekdayLabel(weekday: number, t: (key: string) => string): string {
  return t(WEEKDAY_KEYS[weekday] ?? WEEKDAY_KEYS[0]);
}

type T = (key: string, ...args: any[]) => string;
type Rule = { weekday: number; time: string; durationMinutes: number };

// "Every Sat · 07:00–09:00": the weekday, start time and the end the
// duration gives (wrapping past midnight).
export function scheduleWhen(rule: Rule, t: T): string {
  const [h, m] = rule.time.split(':').map(Number);
  const endMinutes = (h * 60 + m + rule.durationMinutes) % (24 * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  const end = `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`;
  return `${t('sessionRecurringEvery', weekdayLabel(rule.weekday, t))} · ${rule.time}–${end}`;
}

// "Every Sat 07:00": the short form, for a summary of several schedules.
export function scheduleShort(rule: Pick<Rule, 'weekday' | 'time'>, t: T): string {
  return `${t('sessionRecurringEvery', weekdayLabel(rule.weekday, t))} ${rule.time}`;
}
