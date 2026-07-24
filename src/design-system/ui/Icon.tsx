import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import { color } from '../foundation/colors';
import { iconSize, type IconSizeToken } from '../foundation/icon-size';

/**
 * The one place Ionicons is imported directly — DESIGN_SYSTEM.md: "no
 * feature screen may import Ionicons... directly." This is a non-className
 * context (Ionicons takes a `color` prop, not classes), so it consumes
 * foundation/colors.ts's raw JS token values directly — the exact case
 * that tier of the token architecture exists for.
 *
 * Resolves light/dark internally; callers never branch `dark ? '#x' : '#y'`
 * themselves (that pattern, repeated per-callsite today, is what this
 * replaces).
 */

type IconColor = 'default' | 'muted' | 'brand' | 'destructive' | 'onBrand';

type IconProps = {
  name: ComponentProps<typeof Ionicons>['name'];
  size?: IconSizeToken;
  color?: IconColor;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 'md', color: colorToken = 'default', style }: IconProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';

  const resolved: Record<IconColor, string> = {
    default: color.text.default[mode],
    muted: color.text.muted[mode],
    brand: color.brand.primary[mode],
    destructive: color.destructive[mode],
    onBrand: '#ffffff', // icon on top of a solid brand-filled surface, e.g. inside a solid Button
  };

  return <Ionicons name={name} size={iconSize[size]} color={resolved[colorToken]} style={style} />;
}
