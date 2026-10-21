import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';

/**
 * A 44×44 icon-only button (Aksi Sport › IconButton): app-bar actions, a
 * row's ⋯. The label is required — it is all a screen reader gets.
 * `onDark` for asphalt surfaces (live scoring). `dot` adds a heat unread
 * dot at the top right (the bell on Home).
 */

type IconButtonProps = {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress?: () => void;
  onDark?: boolean;
  size?: 'md' | 'lg';
  dot?: boolean;
  className?: string;
};

export function IconButton({ icon, label, onPress, onDark = false, size = 'lg', dot = false, className = '' }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`w-11 h-11 items-center justify-center rounded-full active:opacity-60 ${className}`}
    >
      <Icon name={icon} size={size} color={onDark ? 'onDark' : 'default'} />
      {dot ? (
        <View
          pointerEvents="none"
          className={`absolute top-[9px] right-[10px] w-[9px] h-[9px] rounded-full bg-heat border-2 ${
            onDark ? 'border-asphalt' : 'border-ground dark:border-ground-dark'
          }`}
        />
      ) : null}
    </Pressable>
  );
}
