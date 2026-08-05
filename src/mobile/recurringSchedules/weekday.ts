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
