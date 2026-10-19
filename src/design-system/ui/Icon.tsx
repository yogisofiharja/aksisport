import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import { theme } from '../foundation/theme';
import { iconSize, type IconSizeToken } from '../foundation/icon-size';

/**
 * The one place Ionicons is imported directly — DESIGN_SYSTEM.md: "no
 * feature screen may import Ionicons... directly." This is a non-className
 * context (Ionicons takes a `color` prop, not classes), so it reads
 * foundation/theme.ts's resolved per-mode palette rather than reaching
 * into colors.ts's light/dark pairs directly — theme.ts exists precisely
 * to be this runtime source for non-className consumers; before this, it
 * had no real consumer at all (flagged in the pre-Phase-6 audit).
 *
 * Resolves light/dark internally; callers never branch `dark ? '#x' : '#y'`
 * themselves (that pattern, repeated per-callsite today, is what this
 * replaces).
 */

type IconColor = 'default' | 'muted' | 'brand' | 'secondary' | 'destructive' | 'onBrand' | 'onDark';

type IconProps = {
  name: ComponentProps<typeof Ionicons>['name'];
  size?: IconSizeToken;
  color?: IconColor;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 'md', color: colorToken = 'default', style }: IconProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = theme[mode];

  const resolved: Record<IconColor, string> = {
    default: palette.ink,
    muted: palette.inkMuted,
    // Active/brand icons on ground or surface are heat-strong: plain heat
    // is for fills.
    brand: palette.heatStrong,
    secondary: palette.heatStrong,
    destructive: palette.danger,
    onBrand: palette.onHeat, // on a heat fill (primary Button, checkbox, count): ink, never white
    onDark: palette.onAsphalt, // on asphalt or danger fills
  };

  return <Ionicons name={name} size={iconSize[size]} color={resolved[colorToken]} style={style} />;
}
