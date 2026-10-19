import { Text, View } from 'react-native';

/**
 * Progress bar (Aksi Sport › Progress): how full or how paid a Session is.
 * An 8px bar on `surface-sunken` — `heat` for spots filled, `success` for
 * paid — always with a label and a tabular count above it, so the bar is
 * never the only signal.
 */

type ProgressProps = {
  label: string;
  value: number;
  max: number;
  tone?: 'heat' | 'success';
  /** Text on the right; defaults to "value/max". */
  countLabel?: string;
  className?: string;
};

export function Progress({ label, value, max, tone = 'heat', countLabel, className = '' }: ProgressProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View className={className}>
      <View className="flex-row items-baseline justify-between mb-1.5">
        <Text className="text-sm font-sans-medium text-ink-muted dark:text-ink-muted-dark">{label}</Text>
        <Text className="text-sm font-sans-bold text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
          {countLabel ?? `${value}/${max}`}
        </Text>
      </View>
      <View
        className="h-2 rounded-full bg-surface-sunken dark:bg-surface-sunken-dark overflow-hidden"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max, now: value }}
      >
        <View
          className={`h-2 rounded-full ${tone === 'success' ? 'bg-success dark:bg-success-dark' : 'bg-heat'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </View>
    </View>
  );
}
