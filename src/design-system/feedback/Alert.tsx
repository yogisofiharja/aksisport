import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';

/**
 * Inline banner (Aksi Sport › Alert): `info` for rules and states such as
 * notifications being off. Text is ink on the tint; only the icon carries
 * the colour. At most one action, as an underlined link.
 */
type AlertProps = {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function Alert({ icon, title, children, actionLabel, onAction }: AlertProps) {
  return (
    <View accessibilityRole="summary" className="flex-row gap-3 px-3.5 py-3 rounded-xl bg-info-tint dark:bg-info-tint-dark">
      <Icon name={icon} size="sm" color="info" />
      <View className="flex-1">
        <Text className="text-sm leading-5 font-sans-bold text-ink dark:text-ink-dark">{title}</Text>
        {children ? <Text className="text-sm leading-5 font-sans text-ink dark:text-ink-dark">{children}</Text> : null}
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" className="self-start mt-1.5 active:opacity-60">
            <Text className="text-sm font-sans-bold underline text-ink dark:text-ink-dark">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
