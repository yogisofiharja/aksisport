/**
 * Theme — resolves the light/dark pairs in colors.ts into a single flat
 * palette per mode.
 *
 * This is data only, not a provider. The app already has a working
 * ThemeProvider (`src/theme.tsx`, light/dark/system preference persisted via
 * AsyncStorage, wrapping NativeWind's colorScheme) — Phase 1 does not touch
 * or move it. A later phase can have that provider (or a hook) read from
 * `theme` below instead of raw Tailwind classes; that wiring is out of
 * scope here.
 */

import { color } from './colors';

function resolve(mode: 'light' | 'dark') {
  return {
    background: color.background[mode],
    surface: color.surface[mode],
    border: color.border[mode],
    text: {
      default: color.text.default[mode],
      muted: color.text.muted[mode],
    },
    brand: {
      primary: color.brand.primary[mode],
      primarySubtle: color.brand.primarySubtle[mode],
      secondary: color.brand.secondary[mode],
    },
    destructive: color.destructive[mode],
    success: color.success[mode],
  };
}

export const theme = {
  light: resolve('light'),
  dark: resolve('dark'),
} as const;

export type ThemeMode = keyof typeof theme;
export type ResolvedTheme = typeof theme.light;
