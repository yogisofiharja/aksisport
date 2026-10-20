import { Pressable, Text, View } from 'react-native';
import { CountBadge } from './Chip';

/**
 * Segmented control (Aksi Sport › Tabs › Segmented): 2–4 equal options
 * that filter one list (Upcoming / Past / Drafts) or pick a mode
 * (Singles / Doubles), or switches the views of one screen (a Session's
 * four tabs). The track is `surface-sunken`; the selected segment is
 * raised on `surface`. An option's `count` adds an unread CountBadge after
 * its label.
 */

type Option<T extends string> = { value: T; label: string; count?: number };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Segmented<T extends string>({ options, value, onChange, className = '' }: SegmentedProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      className={`flex-row p-1 rounded-lg bg-surface-sunken dark:bg-surface-sunken-dark ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 h-9 rounded-md flex-row gap-1 px-1 items-center justify-center ${
              selected ? 'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark' : 'active:opacity-60'
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-sm flex-shrink ${
                selected ? 'font-sans-semibold text-ink dark:text-ink-dark' : 'font-sans-medium text-ink-muted dark:text-ink-muted-dark'
              }`}
            >
              {option.label}
            </Text>
            {option.count ? <CountBadge count={option.count} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
