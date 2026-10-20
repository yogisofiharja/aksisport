import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { Icon } from './Icon';

/**
 * A 44×44 icon-only button (Aksi Sport › IconButton): app-bar actions, a
 * row's ⋯. The label is required — it is all a screen reader gets.
 * `onDark` for asphalt surfaces (live scoring).
 */

type IconButtonProps = {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress?: () => void;
  onDark?: boolean;
  size?: 'md' | 'lg';
  className?: string;
};

export function IconButton({ icon, label, onPress, onDark = false, size = 'lg', className = '' }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`w-11 h-11 items-center justify-center rounded-full active:opacity-60 ${className}`}
    >
      <Icon name={icon} size={size} color={onDark ? 'onDark' : 'default'} />
    </Pressable>
  );
}
