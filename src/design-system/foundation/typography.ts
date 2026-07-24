/**
 * Typography scale.
 *
 * The numeric scale matches Tailwind's default `text-*` steps (already the
 * basis for every `Heading`/`Text` size in `components/ui/text.tsx`), so
 * adopting these tokens later requires no new build-time config.
 *
 * The 58 raw `text-[Npx]` values found in the legacy scoring screens
 * (`MobileFinalScreen.tsx`, `MobileHistoryScreen.tsx`, `MobileLineupScreen.tsx`,
 * `SettingsModal.tsx`) are NOT reconciled here — that migration is Phase 2,
 * not Phase 1. This file only defines the target scale those screens will
 * eventually migrate onto.
 */

export const fontSize = {
  xs: { size: 12, lineHeight: 16 },
  sm: { size: 14, lineHeight: 20 },
  base: { size: 16, lineHeight: 24 },
  lg: { size: 18, lineHeight: 28 },
  xl: { size: 20, lineHeight: 28 },
  '2xl': { size: 24, lineHeight: 32 },
  '3xl': { size: 30, lineHeight: 36 },
  '4xl': { size: 36, lineHeight: 40 },
  '5xl': { size: 48, lineHeight: 48 },
} as const;

export type FontSizeToken = keyof typeof fontSize;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

export type FontWeightToken = keyof typeof fontWeight;

/**
 * Semantic roles (DESIGN_TOKENS.md: Display, Heading, Title, Body, Label,
 * Caption), each pointing at one step of the scale above.
 */
export const typeRole = {
  display: { size: fontSize['4xl'], weight: fontWeight.black }, // largest headline
  heading: { size: fontSize['3xl'], weight: fontWeight.black }, // screen titles — matches Heading size="xl" today
  title: { size: fontSize['2xl'], weight: fontWeight.black }, // section/card titles — matches Heading size="lg" today
  body: { size: fontSize.base, weight: fontWeight.regular }, // default text
  label: { size: fontSize.sm, weight: fontWeight.bold }, // form field labels
  caption: { size: fontSize.xs, weight: fontWeight.extrabold }, // eyebrow / section-label text
} as const;

export type TypeRoleToken = keyof typeof typeRole;
