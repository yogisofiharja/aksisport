/**
 * Spacing scale — matches Tailwind's default numeric steps already in use
 * across the app (px-5, pt-4, pb-6, gap-2..6, p-4). Named per
 * DESIGN_TOKENS.md's xs..3xl vocabulary.
 */

export const spacing = {
  xs: 4, // gap-1
  sm: 8, // gap-2 — Add Match chip gaps
  md: 12, // gap-3
  lg: 16, // p-4 / pt-4 / gap-4 — the most common value in the app (cards, scroll wrappers)
  xl: 20, // px-5 / gap-5
  '2xl': 24, // pb-6 / gap-6
  '3xl': 32,
  '4xl': 48,
} as const;

export type SpacingToken = keyof typeof spacing;
