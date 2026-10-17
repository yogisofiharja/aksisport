/**
 * Theme — resolves the light/dark pairs in colors.ts into a single flat
 * palette per mode.
 *
 * This is data only, not a provider. The app's ThemeProvider
 * (`src/theme.tsx`, light/dark/system preference persisted via
 * AsyncStorage, wrapping NativeWind's colorScheme) picks the mode; callers
 * read `theme[mode]`.
 */

import { color, type ColorName } from './colors';

function resolve(mode: 'light' | 'dark') {
  const flat = Object.fromEntries(
    Object.entries(color).map(([name, value]) => [name, value[mode]]),
  ) as Record<ColorName, string>;

  return {
    ...flat,
    // Transitional names, still read by Icon and the tab bar until those
    // components move to the palette names above.
    background: flat.ground,
    text: { default: flat.ink, muted: flat.inkMuted },
    brand: { primary: flat.heat, primarySubtle: flat.heatTint, secondary: flat.heatStrong },
    destructive: flat.danger,
  };
}

export const theme = {
  light: resolve('light'),
  dark: resolve('dark'),
} as const;

export type ThemeMode = keyof typeof theme;
export type ResolvedTheme = typeof theme.light;
