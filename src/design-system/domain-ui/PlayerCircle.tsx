import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';

/**
 * A confirmed player in a Session's Players grid (Aksi Sport ›
 * PlayerCard, circle form): a 64px circle with their initials — dashed for
 * a guest — and a green check on it once they've checked in, then the
 * name and one short line under it ("Host", "Paid", "Awaiting", "Guest").
 * 76px wide, so it sits in the same grid as the open-spot circles.
 *
 * `onPress` makes it a button (an organizer opens the player's sheet).
 */

type PlayerCircleProps = {
  name: string;
  initials: string;
  isGuest?: boolean;
  checkedIn?: boolean;
  /** Someone no longer in (cancelled, didn't show): drawn faded. */
  faded?: boolean;
  /** One short line under the name. */
  caption?: string;
  captionTone?: 'muted' | 'success' | 'warning';
  onPress?: () => void;
  accessibilityLabel?: string;
};

const captionClass = {
  muted: 'text-ink-muted dark:text-ink-muted-dark',
  success: 'text-success dark:text-success-dark',
  warning: 'text-heat-strong dark:text-heat-strong-dark',
};

export function PlayerCircle({
  name,
  initials,
  isGuest = false,
  checkedIn = false,
  faded = false,
  caption,
  captionTone = 'muted',
  onPress,
  accessibilityLabel,
}: PlayerCircleProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [name, caption].filter(Boolean).join(', ')}
      className="items-center active:opacity-70"
      style={{ width: 76, opacity: faded ? 0.5 : 1 }}
    >
      <View
        className={`w-16 h-16 rounded-full items-center justify-center ${
          isGuest
            ? 'bg-surface dark:bg-surface-dark border-2 border-dashed border-border-strong dark:border-border-strong-dark'
            : 'bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-ink dark:border-ink-dark'
        }`}
      >
        <Text className="text-lg font-display text-ink dark:text-ink-dark">{initials}</Text>
        {checkedIn ? (
          <View className="absolute -right-0.5 -bottom-0.5 w-6 h-6 rounded-full items-center justify-center bg-success dark:bg-success-dark border-2 border-ground dark:border-ground-dark">
            <Icon name="checkmark" size="xs" color="inverse" />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} className="mt-1.5 text-[13px] leading-[18px] font-sans-semibold text-ink dark:text-ink-dark text-center">
        {name}
      </Text>
      {caption ? (
        <Text numberOfLines={1} className={`text-[11px] leading-4 font-sans-semibold text-center ${captionClass[captionTone]}`}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}
