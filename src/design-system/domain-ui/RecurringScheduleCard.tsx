import { Pressable, Text, View } from 'react-native';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { Typography } from '../ui/Typography';

/**
 * A Recurring Schedule (Aksi redesign › RecurringScheduleCard): a schedule,
 * not a Session, so no date and no capacity. A 44px repeat icon on
 * surface-sunken, the title, "Every Sat · 07:00–09:00" (`subtitle`, formatted
 * by the caller), and an Active (success) or Paused (muted) pill. Paused
 * mutes the title and icon too, so the row says why nothing is being
 * created.
 *
 * Renders only (DOMAIN_UI.md): `onPress` is a plain callback.
 */

type RecurringScheduleCardProps = {
  title: string;
  subtitle?: string; // "Every Sat · 07:00–09:00"
  statusLabel: string;
  isPaused: boolean;
  onPress?: () => void;
  className?: string;
};

export function RecurringScheduleCard({
  title,
  subtitle,
  statusLabel,
  isPaused,
  onPress,
  className = '',
}: RecurringScheduleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={`flex-row items-center gap-3 px-3.5 py-3 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl ${
        onPress ? 'active:opacity-70' : ''
      } ${className}`}
    >
      <View className="w-11 h-11 rounded-xl items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark">
        <Icon name="repeat" size="md" color={isPaused ? 'muted' : 'default'} />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className={`font-display text-[17px] leading-[22px] ${
            isPaused ? 'text-ink-muted dark:text-ink-muted-dark' : 'text-ink dark:text-ink-dark'
          }`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Typography variant="body" color="muted" className="text-[13px] leading-[18px]" numberOfLines={1}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
      <Badge action={isPaused ? 'draft' : 'ready'} text={statusLabel} caps className="self-center" />
    </Pressable>
  );
}
