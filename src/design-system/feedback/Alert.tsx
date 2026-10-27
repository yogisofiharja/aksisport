import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';

/**
 * Inline banner (Aksi Sport › Alert). Text is ink on the tint; only the
 * icon carries the colour.
 *
 * - `info`: rules and states, such as notifications being off.
 * - `heat`: something for the organizer to act on (join requests, a draft
 *   to finish). One per screen, usually first.
 * - `danger`: a blocking state, or reports waiting.
 *
 * At most one action: an underlined link (`actionLabel` + `onAction`), or
 * with `onPress` the whole banner is the tap target, ending in a chevron
 * ("2 people want to join · Review").
 */
type Tone = 'info' | 'heat' | 'danger';

const toneClass: Record<Tone, string> = {
  info: 'bg-info-tint dark:bg-info-tint-dark',
  heat: 'bg-heat-tint dark:bg-heat-tint-dark',
  danger: 'bg-danger-tint dark:bg-danger-tint-dark',
};
const toneIcon: Record<Tone, ComponentProps<typeof Icon>['color']> = {
  info: 'info',
  heat: 'brand',
  danger: 'destructive',
};

type AlertProps = {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  tone?: Tone;
  /** Shown after the title on the same line, in regular weight ("· Review"). */
  titleSuffix?: string;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onPress?: () => void;
};

export function Alert({ icon, title, tone = 'info', titleSuffix, children, actionLabel, onAction, onPress }: AlertProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      className={`flex-row items-center gap-3 px-3.5 py-3 rounded-xl ${toneClass[tone]} ${onPress ? 'active:opacity-70' : ''}`}
    >
      <View className={children || actionLabel ? 'self-start mt-0.5' : ''}>
        <Icon name={icon} size="sm" color={toneIcon[tone]} />
      </View>
      <View className="flex-1">
        <Text className="text-sm leading-5 text-ink dark:text-ink-dark">
          <Text className="font-sans-bold">{title}</Text>
          {titleSuffix ? <Text className="font-sans">{` · ${titleSuffix}`}</Text> : null}
        </Text>
        {children ? <Text className="text-sm leading-5 font-sans text-ink dark:text-ink-dark">{children}</Text> : null}
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" className="self-start mt-1.5 active:opacity-60">
            <Text className="text-sm font-sans-bold underline text-ink dark:text-ink-dark">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size="sm" color="default" /> : null}
    </Pressable>
  );
}
