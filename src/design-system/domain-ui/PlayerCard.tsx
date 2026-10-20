import type { ReactNode } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { initialsFromName } from '../../core/initials';
import { Typography } from '../ui/Typography';

/**
 * A person in a Community or a Session (Aksi redesign › PlayerCard): a 40px
 * round avatar, the name (15px/600) and a subline — "@username" on the
 * Members tab, check-in status ("Checked in · host") on a Session's
 * Players tab.
 *
 * - `isOnline` adds a green dot ringed in surface.
 * - `isGuest` draws the avatar dashed in border-strong (a guest has no
 *   account, so no picture and no presence).
 * - The picture shows when the screen passes `avatarSource` (it needs auth
 *   headers); otherwise initials.
 *
 * `trailing` stays composed by the screen: an Owner tag, an Admin tag, a
 * Paid / Awaiting pill, a ⋯ button or an Approve button. Which of those
 * apply is Community or Session membership logic, not this component's
 * concern (DOMAIN_UI.md). Named PlayerCard for sport-neutral naming. A
 * Badge or Chip set in a row beside another control needs `self-center`
 * (both default to `self-start`).
 */

type PlayerCardProps = {
  name: string;
  /** When the shown name carries extra text ("Yogi (You)"). */
  initials?: string;
  subtitle?: string; // "@username" or check-in status
  avatarSource?: ImageSourcePropType;
  isOnline?: boolean;
  isGuest?: boolean;
  trailing?: ReactNode;
  className?: string;
};

export function PlayerCard({
  name,
  initials,
  subtitle,
  avatarSource,
  isOnline = false,
  isGuest = false,
  trailing,
  className = '',
}: PlayerCardProps) {
  return (
    <View
      className={`flex-row items-center gap-3 px-3.5 py-2.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl ${className}`}
    >
      <View className="w-10 h-10">
        <View
          className={`w-10 h-10 rounded-full overflow-hidden items-center justify-center ${
            isGuest
              ? 'bg-surface dark:bg-surface-dark border border-dashed border-border-strong dark:border-border-strong-dark'
              : 'bg-surface-sunken dark:bg-surface-sunken-dark'
          }`}
        >
          {avatarSource && !isGuest ? (
            <Image source={avatarSource} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          ) : (
            <Typography variant="label" className={`font-sans-bold ${isGuest ? 'text-ink-muted dark:text-ink-muted-dark' : ''}`}>
              {isGuest ? 'G' : (initials ?? initialsFromName(name))}
            </Typography>
          )}
        </View>
        {isOnline && !isGuest ? (
          <View className="absolute -right-px -bottom-px w-3 h-3 rounded-full bg-success dark:bg-success-dark border-2 border-surface dark:border-surface-dark" />
        ) : null}
      </View>
      <View className="flex-1 min-w-0">
        <Typography variant="body" className="text-[15px] leading-5 font-semibold" numberOfLines={1}>
          {name}
        </Typography>
        {subtitle ? (
          <Typography variant="body" color="muted" className="text-[13px] leading-[18px]" numberOfLines={1}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}
