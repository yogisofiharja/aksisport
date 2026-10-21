import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

/**
 * The top of a screen (Aksi redesign › App bar). Pick the variant by where
 * the screen sits, not by taste:
 *
 * - `root`: a tab root (Home, Explore, Inbox, Me). A small date line over a
 *   big Saira italic 34px title, up to two icons, no back, no border.
 * - `stack`: a pushed screen (Session, Community, profile). Back, a
 *   17px/700 title with a 12px ink-muted context line, up to two icons;
 *   with `onMore`, ⋯ takes the second slot and everything else goes behind
 *   it. `largeTitle` adds a Saira 34px title under the bar (the Community
 *   tabs), which scrolls away with the content.
 * - `form`: create / edit. ✕ Close on the left, never back, then the title
 *   and context line.
 *
 * `tone="dark"` is the live-scoring bar: asphalt with surface-coloured
 * text. Every icon button is 44×44; the bar is at least 56px tall, with a
 * bottom border except on root.
 *
 * `textAction` is one short text button on the right in heat-strong
 * ("Mark all read"), in place of icons.
 *
 * A chat's stack bar puts the person or group avatar before the title
 * (`titleAvatar`) and opens its info from the title (`onPressTitle`).
 *
 * Renders only: back, close and actions are plain callbacks. It sits inside
 * the screen's own safe area; `safeTop` pads by the top inset for a screen
 * that has none.
 */

type IconName = ComponentProps<typeof Icon>['name'];

export type AppBarAction = { icon: IconName; label: string; onPress: () => void; dot?: boolean };

type AppBarProps = {
  variant?: 'root' | 'stack' | 'form';
  title?: string;
  /** stack / form: the line under the title, e.g. the Community name. */
  context?: string;
  /** root: the small line over the title, e.g. "Monday 20 Oct". */
  dateLine?: string;
  /** stack: a Saira 34px title under the bar. */
  largeTitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  actions?: AppBarAction[];
  /** Shows ⋯ as the last icon; overflow actions open from it. */
  onMore?: () => void;
  tone?: 'light' | 'dark';
  safeTop?: boolean;
  /** stack: one text button on the right, e.g. "Mark all read". */
  textAction?: { label: string; onPress: () => void };
  /** stack: an avatar before the title (a chat). */
  titleAvatar?: ReactNode;
  /** stack: makes the title block tappable (a chat's info). */
  onPressTitle?: () => void;
};

export function AppBar({
  variant = 'stack',
  title,
  context,
  dateLine,
  largeTitle,
  onBack,
  onClose,
  actions = [],
  onMore,
  tone = 'light',
  safeTop = false,
  titleAvatar,
  onPressTitle,
  textAction,
}: AppBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dark = tone === 'dark';
  const bg = dark ? 'bg-asphalt dark:bg-asphalt-dark' : 'bg-ground dark:bg-ground-dark';
  const ink = dark ? 'text-on-asphalt' : 'text-ink dark:text-ink-dark';
  const muted = dark ? 'text-ink-muted-dark' : 'text-ink-muted dark:text-ink-muted-dark';
  const topPad = safeTop ? insets.top : 0;

  const icons = actions.slice(0, onMore ? 1 : 2).map((a) => (
    <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} onDark={dark} dot={a.dot} />
  ));
  if (onMore) icons.push(<IconButton key="more" icon="ellipsis-horizontal" label={t('appBarMore')} onPress={onMore} onDark={dark} />);

  if (variant === 'root') {
    return (
      <View className={`flex-row items-end justify-between pl-4 pr-1 pb-2 ${bg}`} style={{ paddingTop: 16 + topPad }}>
        <View className="flex-1 min-w-0">
          {dateLine ? <Text className={`text-[13px] leading-[18px] font-sans-semibold ${muted}`}>{dateLine}</Text> : null}
          {title ? (
            <Text accessibilityRole="header" className={`text-[34px] leading-[38px] font-display-hero ${ink}`} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        {icons.length > 0 ? <View className="flex-row">{icons}</View> : null}
      </View>
    );
  }

  const leading =
    variant === 'form' ? (
      onClose ? <IconButton icon="close" label={t('close')} onPress={onClose} onDark={dark} /> : null
    ) : onBack ? (
      <IconButton icon="chevron-back" label={t('back')} onPress={onBack} onDark={dark} />
    ) : null;

  const border = dark ? '' : 'border-b border-border dark:border-border-dark';

  return (
    <View className={`${bg} ${border}`} style={{ paddingTop: topPad }}>
      <View className="flex-row items-center gap-1 min-h-[56px] px-1">
        {leading}
        <Pressable
          onPress={onPressTitle}
          disabled={!onPressTitle}
          className={`flex-1 min-w-0 flex-row items-center gap-3 px-1 ${leading ? '' : 'pl-3'} ${onPressTitle ? 'active:opacity-70' : ''}`}
        >
          {titleAvatar}
          <View className="flex-1 min-w-0">
            {title ? (
              <Text accessibilityRole="header" className={`text-[17px] leading-[22px] font-sans-bold ${ink}`} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {context ? (
              <Text className={`text-xs leading-4 font-sans-medium ${muted}`} numberOfLines={1}>
                {context}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {icons}
        {textAction ? (
          <Pressable onPress={textAction.onPress} accessibilityRole="button" className="h-11 px-2 justify-center active:opacity-60">
            <Text className={`text-sm font-sans-semibold ${dark ? 'text-heat-on-asphalt' : 'text-heat-strong dark:text-heat-strong-dark'}`}>
              {textAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {variant === 'stack' && largeTitle ? (
        <Text accessibilityRole="header" className={`px-4 pb-3 text-[34px] leading-[38px] font-display-hero ${ink}`} numberOfLines={2}>
          {largeTitle}
        </Text>
      ) : null}
    </View>
  );
}
