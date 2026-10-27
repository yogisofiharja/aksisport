import { Children, Fragment, type ComponentProps, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';

/**
 * Lists (Aksi Sport › ListItem).
 *
 * - `ListGroup`: rows in one surface card with a hairline between them
 *   (Settings, Me, Notifications, Inbox, Home's session rows).
 * - `ListRow`: an optional leading icon tile or node, a title, up to two
 *   lines under it, and a trailing node and/or chevron. `danger` is for
 *   Log out. A row inside a ListGroup has no frame of its own; `framed`
 *   makes it a card on its own (`'light'`), or the asphalt card that leads
 *   a screen (`'dark'`, a heat icon tile: First run's Find a community).
 *
 * Renders only: `onPress` is a plain callback.
 */

type IconName = ComponentProps<typeof Icon>['name'];
type IconTone = 'neutral' | 'heat' | 'success' | 'info';

const tileClass: Record<IconTone, string> = {
  neutral: 'bg-surface-sunken dark:bg-surface-sunken-dark',
  heat: 'bg-heat-tint dark:bg-heat-tint-dark',
  success: 'bg-success-tint dark:bg-success-tint-dark',
  info: 'bg-info-tint dark:bg-info-tint-dark',
};
const tileIcon: Record<IconTone, ComponentProps<typeof Icon>['color']> = {
  neutral: 'default',
  heat: 'brand',
  success: 'success',
  info: 'info',
};

export function ListGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  const rows = Children.toArray(children).filter(Boolean);
  // A group whose rows are all hidden (a menu for a plain member) draws nothing.
  if (rows.length === 0) return null;
  return (
    <View className={`bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl overflow-hidden ${className}`}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View className="h-px bg-border dark:bg-border-dark" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

type ListRowProps = {
  title: string;
  /** Bold title (an unread notification, a framed card). */
  strong?: boolean;
  /** Lines the title may wrap to; 1 by default. */
  titleLines?: number;
  subtitle?: string;
  /** A third, smaller line (a time). */
  meta?: string;
  /** Small muted text right of the title (an Inbox row's time). */
  aside?: string;
  icon?: IconName;
  iconTone?: IconTone;
  /** Instead of `icon`: an avatar or a day block. */
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
  framed?: 'light' | 'dark';
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({
  title,
  strong = false,
  titleLines = 1,
  subtitle,
  meta,
  aside,
  icon,
  iconTone = 'neutral',
  leading,
  trailing,
  chevron = false,
  danger = false,
  framed,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const dark = framed === 'dark';
  const frame = framed
    ? dark
      ? 'rounded-xl bg-asphalt dark:bg-asphalt-dark'
      : 'rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark'
    : '';
  const titleColor = danger ? 'text-danger dark:text-danger-dark' : dark ? 'text-on-asphalt' : 'text-ink dark:text-ink-dark';
  const mutedColor = dark ? 'text-ink-muted-dark' : 'text-ink-muted dark:text-ink-muted-dark';
  const tileSize = framed ? 'w-11 h-11 rounded-xl' : 'w-10 h-10 rounded-lg';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      className={`flex-row items-center gap-3 px-4 ${framed ? 'py-3.5' : 'py-3'} ${frame} ${onPress ? 'active:opacity-70' : ''}`}
    >
      {leading ??
        (icon ? (
          <View className={`${tileSize} items-center justify-center ${dark ? 'bg-heat' : danger ? 'bg-danger-tint dark:bg-danger-tint-dark' : tileClass[iconTone]}`}>
            <Icon name={icon} size="md" color={dark ? 'onBrand' : danger ? 'destructive' : tileIcon[iconTone]} />
          </View>
        ) : null)}
      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline gap-2">
          <Text
            numberOfLines={titleLines}
            className={`flex-1 ${framed ? 'text-base leading-[22px]' : 'text-[15px] leading-[21px]'} ${
              strong || framed ? 'font-sans-bold' : 'font-sans-semibold'
            } ${titleColor}`}
          >
            {title}
          </Text>
          {aside ? <Text className={`text-xs font-sans-medium ${mutedColor}`}>{aside}</Text> : null}
        </View>
        {subtitle ? (
          <Text numberOfLines={2} className={`text-[13px] leading-[18px] font-sans ${mutedColor}`}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text numberOfLines={1} className={`mt-0.5 text-xs leading-4 font-sans-medium ${mutedColor}`}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-forward" size="sm" color={dark ? 'onDark' : 'muted'} /> : null}
    </Pressable>
  );
}
