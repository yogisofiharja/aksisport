/**
 * Semantic color tokens — composes:
 * - Tier 1 (./tokens/colors): AKSI's own brand scale (blue `primary`),
 *   single-sourced with tailwind.config.js (which requires the same file —
 *   see tailwind.config.js's `primaryTokens`).
 * - Tier 2 (tailwindcss/colors): Tailwind's default palette, imported
 *   directly from the tailwindcss package itself — the exact same data
 *   NativeWind resolves `bg-slate-500` etc. to at build time. No hand-copied
 *   hex values.
 *
 * This file owns only Tier 3: semantic naming and light/dark pairing. That
 * pairing is an actual design decision (e.g. "muted text is slate-500 in
 * light mode, slate-400 in dark") and can't be sourced from anywhere — it's
 * the real content of this file.
 *
 * NOT reflected below: tailwind.config.js also defines `secondary`
 * (#64748b), `background` (#0f1021), `foreground`, `accent`, `destructive`,
 * `success` as bare custom tokens, separate from the `primary` scale sourced
 * here. Verified these have zero live consumers — the only file referencing
 * them (`src/components/ui.tsx`) is itself unimported dead code. Flagged as
 * an open decision, not silently adopted or removed.
 */

import brand from './tokens/colors';
import tw from 'tailwindcss/colors';

type ThemeColor = { light: string; dark: string };

export const color = {
  brand: {
    primary: { light: brand[600], dark: brand[600] } as ThemeColor,
    // blue-600/20 has no flat default-palette equivalent (it's an opacity
    // composition, not a palette entry) — stays hand-authored.
    primarySubtle: { light: brand[50], dark: 'rgba(37, 99, 235, 0.2)' } as ThemeColor,
    // Not tailwind.config.js's `secondary` (#64748b, unused) — this is
    // Tailwind's default blue-600, the color actually behind every
    // action="secondary" button and the club/session management screens.
    secondary: { light: tw.blue[600], dark: tw.blue[600] } as ThemeColor,
  },

  background: { light: tw.slate[50], dark: tw.slate[900] } as ThemeColor, // screen background
  surface: { light: tw.white, dark: tw.slate[800] } as ThemeColor, // card background
  border: { light: tw.slate[200], dark: tw.slate[600] } as ThemeColor, // input/card borders

  text: {
    default: { light: tw.slate[900], dark: tw.slate[50] } as ThemeColor,
    muted: { light: tw.slate[500], dark: tw.slate[400] } as ThemeColor,
  },

  destructive: { light: tw.red[600], dark: tw.red[600] } as ThemeColor,
  success: { light: tw.teal[600], dark: tw.teal[600] } as ThemeColor,
} as const;

export type ColorToken = typeof color;
