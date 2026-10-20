import { Pressable, Text, View } from 'react-native';

/**
 * Chips (Aksi Sport › Chip).
 *
 * - `Chip` with `onPress`: a filter chip — 36px, `border-strong` outline;
 *   selected flips to an ink fill with surface text. Put a row of them in a
 *   horizontal ScrollView; never wrap them to a fixed width.
 * - `Chip` without `onPress`: a tag — a static label such as a skill level
 *   or a role (Admin, Owner). Not tappable. `strong` fills it with ink, for
 *   the one role that outranks the rest (Owner).
 * - `CountBadge`: an unread count, heat with ink numerals (`muted` for a
 *   plain total), capped at 99+.
 *
 * Lifecycle states are not chips; they use Badge's StatusPill actions.
 */

type ChipProps = {
  label: string;
  selected?: boolean;
  /** Tag only: ink fill (Owner). */
  strong?: boolean;
  onPress?: () => void;
  className?: string;
};

export function Chip({ label, selected = false, strong = false, onPress, className = '' }: ChipProps) {
  if (!onPress) {
    return (
      <View
        className={`self-start rounded-md px-2 py-0.5 ${
          strong ? 'bg-ink dark:bg-ink-dark' : 'bg-surface-sunken dark:bg-surface-sunken-dark'
        } ${className}`}
      >
        <Text
          className={`text-xs font-sans-semibold ${
            strong ? 'text-surface dark:text-surface-dark' : 'text-ink-muted dark:text-ink-muted-dark'
          }`}
        >
          {label}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`h-9 px-3.5 rounded-full items-center justify-center border active:opacity-70 ${
        selected
          ? 'bg-ink dark:bg-ink-dark border-ink dark:border-ink-dark'
          : 'border-border-strong dark:border-border-strong-dark'
      } ${className}`}
    >
      <Text
        className={`text-sm font-sans-semibold ${
          selected ? 'text-surface dark:text-surface-dark' : 'text-ink dark:text-ink-dark'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type CountBadgeProps = { count: number; muted?: boolean; className?: string; accessibilityLabel?: string };

export function CountBadge({ count, muted = false, className = '', accessibilityLabel }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      className={`min-w-[20px] h-5 px-1.5 rounded-full items-center justify-center ${
        muted ? 'bg-surface-sunken dark:bg-surface-sunken-dark' : 'bg-heat'
      } ${className}`}
    >
      <Text
        className={`text-[11px] font-sans-bold ${muted ? 'text-ink-muted dark:text-ink-muted-dark' : 'text-on-heat'}`}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}
