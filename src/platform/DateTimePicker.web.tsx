import { createElement } from 'react';

// Browser stand-in for @react-native-community/datetimepicker: the
// browser's own date/time input, behind the same props the app passes the
// native picker, so screens don't branch on platform. `display` is a
// native-only presentation hint and is ignored.
type Props = {
  value: Date;
  mode: 'date' | 'time';
  display?: string;
  themeVariant?: 'light' | 'dark';
  onChange: (event: unknown, selected?: Date) => void;
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function DateTimePicker({ value, mode, themeVariant, onChange }: Props) {
  const inputValue =
    mode === 'date'
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : `${pad(value.getHours())}:${pad(value.getMinutes())}`;

  return createElement('input', {
    type: mode,
    value: inputValue,
    onChange: (event: { target: { value: string } }) => {
      const raw = event.target.value;
      if (!raw) return;
      const next = new Date(value);
      if (mode === 'date') {
        const [year, month, day] = raw.split('-').map(Number);
        next.setFullYear(year, month - 1, day);
      } else {
        const [hours, minutes] = raw.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }
      onChange(event, next);
    },
    style: {
      font: 'inherit',
      fontSize: 16,
      padding: '10px 12px',
      borderRadius: 12,
      border: '1px solid rgba(100, 116, 139, 0.4)',
      background: 'transparent',
      // Explicit, not inherited: the input sits outside any RN <Text>, so
      // it would otherwise pick up the document's default black.
      color: themeVariant === 'dark' ? '#f1f5f9' : '#0f172a',
      colorScheme: themeVariant === 'dark' ? 'dark' : 'light',
      alignSelf: 'flex-start',
    },
  });
}
