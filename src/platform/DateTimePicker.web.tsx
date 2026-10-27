import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Icon } from '../design-system/ui/Icon';
import { useTranslation } from '../i18n';
import { webSelectStyle } from './webSelectStyle';

// Browser stand-in for @react-native-community/datetimepicker, behind the
// same props the app passes the native picker, so screens don't branch on
// platform. Built from the app's own components rather than the browser's
// <input type="date|time">, whose pop-up calendar can't be styled and
// looked nothing like the rest of the app. `display="inline"` shows the
// month calendar on its own, already open (inside a picker Sheet); other
// `display` values are native-only hints and are ignored.
type Props = {
  value: Date;
  mode: 'date' | 'time';
  display?: string;
  themeVariant?: 'light' | 'dark';
  onChange: (event: unknown, selected?: Date) => void;
};

export default function DateTimePicker(props: Props) {
  return props.mode === 'date' ? <DateField {...props} /> : <TimeField {...props} />;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// A field showing the chosen date; tapping it opens a month calendar
// inline, directly below — same reveal-in-place pattern the native forms
// use, so nothing floats over the page.
function DateField({ value, onChange, display }: Props) {
  const { lang } = useTranslation();
  const inline = display === 'inline';
  const [open, setOpen] = useState(inline);
  // The month on screen, independent of the selected date while browsing.
  const [shown, setShown] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const today = new Date();
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const leadingBlanks = new Date(year, month, 1).getDay(); // weeks start on Sunday, like the weekday chips
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // 4 Jan 1970 was a Sunday — a fixed week to read localized weekday initials from.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(1970, 0, 4 + i).toLocaleDateString(lang, { weekday: 'short' })
  );

  function toggle() {
    if (!open) setShown(new Date(value.getFullYear(), value.getMonth(), 1));
    setOpen(!open);
  }

  function pick(day: number) {
    const next = new Date(value);
    next.setFullYear(year, month, day);
    onChange(null, next);
    if (!inline) setOpen(false);
  }

  return (
    <View className="gap-2">
      {inline ? null : (
        <Pressable
          onPress={toggle}
          className="flex-row items-center justify-between px-4 py-3 rounded-xl bg-surface-sunken dark:bg-surface-sunken-dark active:opacity-70"
        >
          <Text className="text-base font-bold text-ink dark:text-ink-dark">
            {value.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Icon name="calendar-outline" size="sm" color="muted" />
        </Pressable>
      )}

      {open && (
        <View className="rounded-2xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark p-3 gap-2">
          <View className="flex-row items-center justify-between">
            <Pressable className="p-2 active:opacity-60" onPress={() => setShown(new Date(year, month - 1, 1))} hitSlop={6}>
              <Icon name="chevron-back" size="sm" />
            </Pressable>
            <Text className="text-base font-extrabold text-ink dark:text-ink-dark">
              {shown.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable className="p-2 active:opacity-60" onPress={() => setShown(new Date(year, month + 1, 1))} hitSlop={6}>
              <Icon name="chevron-forward" size="sm" />
            </Pressable>
          </View>

          <View className="flex-row">
            {weekdayLabels.map((label, i) => (
              <Text key={i} className="flex-1 text-center text-xs font-bold text-ink-faint dark:text-ink-faint-dark uppercase">
                {label}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {cells.map((day, i) => {
              if (day == null) return <View key={i} style={{ width: `${100 / 7}%` }} className="h-10" />;
              const cellDate = new Date(year, month, day);
              const selected = sameDay(cellDate, value);
              const isToday = sameDay(cellDate, today);
              return (
                <View key={i} style={{ width: `${100 / 7}%` }} className="h-10 items-center justify-center">
                  <Pressable
                    onPress={() => pick(day)}
                    className={`w-9 h-9 rounded-full items-center justify-center active:opacity-70 ${
                      selected ? 'bg-heat' : isToday ? 'border border-heat' : ''
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        selected ? 'font-sans-bold text-on-heat' : 'font-semibold text-ink dark:text-ink-dark'
                      }`}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_STEP = 5;

// Hour and minute as two of the app's own dropdowns — the same control as
// Duration right below it on the forms. Minutes step by 5; a value that
// isn't on a step (loaded from an existing Session) stays selectable.
function TimeField({ value, themeVariant, onChange }: Props) {
  const isDark = themeVariant === 'dark';
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  if (!minutes.includes(value.getMinutes())) {
    minutes.push(value.getMinutes());
    minutes.sort((a, b) => a - b);
  }

  function set(hours: number, mins: number) {
    const next = new Date(value);
    next.setHours(hours, mins, 0, 0);
    onChange(null, next);
  }

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">
        <Picker selectedValue={value.getHours()} onValueChange={(h) => set(Number(h), value.getMinutes())} style={webSelectStyle(isDark)}>
          {HOURS.map((h) => (
            <Picker.Item key={h} label={pad(h)} value={h} />
          ))}
        </Picker>
      </View>
      <Text className="text-base font-extrabold text-ink-muted dark:text-ink-muted-dark">:</Text>
      <View className="flex-1">
        <Picker selectedValue={value.getMinutes()} onValueChange={(m) => set(value.getHours(), Number(m))} style={webSelectStyle(isDark)}>
          {minutes.map((m) => (
            <Picker.Item key={m} label={pad(m)} value={m} />
          ))}
        </Picker>
      </View>
    </View>
  );
}
