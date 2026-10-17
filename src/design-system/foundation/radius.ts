/**
 * Corner radius (Aksi Sport design system). Tailwind equivalents:
 * xs `rounded`, sm `rounded-lg`, md `rounded-xl`, lg `rounded-[20px]`,
 * full `rounded-full`.
 */

export const radius = {
  xs: 4, // score cells, checkbox
  sm: 8, // buttons, inputs, chips
  md: 12, // cards
  lg: 20, // sheets, dialogs
  full: 9999, // pills, avatars
} as const;

export type RadiusToken = keyof typeof radius;
