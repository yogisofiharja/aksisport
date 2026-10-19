import { Pressable, Text, View } from 'react-native';

/**
 * Segmented control (Aksi Sport › Tabs › Segmented): 2–4 equal options
 * that filter one list (Upcoming / Past / Drafts) or pick a mode
 * (Singles / Doubles). The track is `surface-sunken`; the selected segment
 * is raised on `surface`.
 */

type Option<T extends string> = { value: T; label: string };

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
            className={`flex-1 h-9 rounded-md items-center justify-center ${
              selected ? 'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark' : 'active:opacity-60'
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-sm ${
                selected ? 'font-sans-semibold text-ink dark:text-ink-dark' : 'font-sans-medium text-ink-muted dark:text-ink-muted-dark'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
