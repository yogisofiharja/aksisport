import type { ReactNode } from 'react';
import { Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import { initialsFromName } from '../../core/initials';
import { useTranslation } from '../../i18n';
import { Icon } from '../ui/Icon';
import { Typography } from '../ui/Typography';

/**
 * A Community (Aksi redesign › ClubCard), two layouts from the same props:
 *
 * - `tile` (Home): 150px wide, avatar over the name and "Owner · Jakarta
 *   Selatan" (`roleLabel` · `cityName`).
 * - `new` (Home, after the tiles): a dashed 100px tile with + and `name`
 *   as its label ("New community").
 * - `row` (Explore): avatar, name, "Jakarta Pusat · 42 members", plus
 *   "· private" for a private Community. Trailing: "Joined" when the viewer
 *   has a role, "Requested" while their request is pending, otherwise a
 *   chevron. Tapping opens the Community page; Join lives there, never on
 *   the row — except on a Session's Details tab (DP-028), which passes its
 *   own `subline` ("Jakarta Selatan · Public · 42 members") and, for a
 *   non-member, a Join button as `action` in place of the trailing text.
 *
 * The avatar is the Community's image when `hasAvatar` and the screen
 * passes `avatarSource` (it needs auth headers, which only the screen
 * knows), otherwise initials on heat-tint. 44px, radius 12.
 *
 * Renders only (DOMAIN_UI.md): `onPress` is a plain callback.
 */

type ClubCardProps = {
  name: string;
  variant?: 'tile' | 'row' | 'new';
  hasAvatar?: boolean;
  avatarSource?: ImageSourcePropType;
  /** Translated role, e.g. "Owner" (tile). */
  roleLabel?: string;
  cityName?: string;
  /** Row only. */
  memberCount?: number;
  isPrivate?: boolean;
  /** Row only: the viewer is a member. */
  viewerRole?: string;
  /** Row only: the viewer asked to join and is waiting. */
  viewerRequestPending?: boolean;
  /** Row only: replaces the built subline. */
  subline?: string;
  /** Row only: a trailing control (Join), in place of the badge/chevron. */
  action?: ReactNode;
  onPress?: () => void;
  className?: string;
};

// Plain Text, not Typography's `title`: its 26px line height would win over
// a className override.
const NAME = 'font-display text-[17px] leading-[22px] text-ink dark:text-ink-dark';

function ClubAvatar({ name, hasAvatar, source }: { name: string; hasAvatar?: boolean; source?: ImageSourcePropType }) {
  return (
    <View className="w-11 h-11 rounded-xl overflow-hidden items-center justify-center bg-heat-tint dark:bg-heat-tint-dark">
      {hasAvatar && source ? (
        <Image source={source} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
      ) : (
        <Text className="font-display text-lg leading-[22px] text-heat-strong dark:text-heat-strong-dark">{initialsFromName(name)}</Text>
      )}
    </View>
  );
}

export function ClubCard({
  name,
  variant = 'row',
  hasAvatar,
  avatarSource,
  roleLabel,
  cityName,
  memberCount,
  isPrivate = false,
  viewerRole,
  viewerRequestPending = false,
  subline: sublineOverride,
  action,
  onPress,
  className = '',
}: ClubCardProps) {
  const { t } = useTranslation();
  const frame = `bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl ${
    onPress ? 'active:opacity-70' : ''
  }`;

  if (variant === 'new') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={`w-[100px] p-3.5 rounded-xl items-center justify-center gap-1.5 border-2 border-dashed border-border-strong dark:border-border-strong-dark active:opacity-70 ${className}`}
      >
        <Icon name="add" size="lg" color="default" />
        <Typography variant="label" className="text-center text-[13px]">
          {name}
        </Typography>
      </Pressable>
    );
  }

  if (variant === 'tile') {
    const subline = [roleLabel, cityName].filter(Boolean).join(' · ');
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        className={`w-[150px] p-3.5 gap-2.5 ${frame} ${className}`}
      >
        <ClubAvatar name={name} hasAvatar={hasAvatar} source={avatarSource} />
        <View>
          <Text className={NAME} numberOfLines={2}>
            {name}
          </Text>
          {subline ? (
            <Typography variant="caption" color="muted" className="font-sans leading-4" numberOfLines={2}>
              {subline}
            </Typography>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const subline =
    sublineOverride ??
    [cityName, memberCount != null ? t('clubMemberCount', memberCount) : undefined, isPrivate ? t('cardPrivate') : undefined]
      .filter(Boolean)
      .join(' · ');
  const trailing = viewerRole ? t('clubJoinedBadge') : viewerRequestPending ? t('clubRequestedBadge') : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={`flex-row items-center gap-3 px-3.5 py-3 ${frame} ${className}`}
    >
      <ClubAvatar name={name} hasAvatar={hasAvatar} source={avatarSource} />
      <View className="flex-1 min-w-0">
        <Text className={NAME} numberOfLines={1}>
          {name}
        </Text>
        {subline ? (
          <Typography variant="body" color="muted" className="text-[13px] leading-[18px]" numberOfLines={2}>
            {subline}
          </Typography>
        ) : null}
      </View>
      {action ? (
        action
      ) : trailing ? (
        <Typography variant="body" color="muted" className="text-[13px] font-semibold">
          {trailing}
        </Typography>
      ) : (
        <Icon name="chevron-forward" size="md" color="muted" />
      )}
    </Pressable>
  );
}
