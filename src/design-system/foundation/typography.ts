/**
 * Type (Aksi Sport design system): Saira for display text, Plus Jakarta
 * Sans for everything else. The font files live in assets/fonts/ and are
 * loaded in App.tsx under the family names below; tailwind.config.js has
 * the matching `font-*` classes.
 *
 * React Native picks a font file by family name, not by weight, so each
 * weight is its own family. The heaviest weight is 800, used only for the
 * hero line.
 */

export const fontFamily = {
  sans: 'PlusJakartaSans-Regular', // font-sans
  sansMedium: 'PlusJakartaSans-Medium', // font-sans-medium
  sansSemibold: 'PlusJakartaSans-SemiBold', // font-sans-semibold
  sansBold: 'PlusJakartaSans-Bold', // font-sans-bold
  display: 'Saira-Bold', // font-display
  displayHero: 'Saira-ExtraBoldItalic', // font-display-hero
} as const;

export type FontFamilyToken = keyof typeof fontFamily;

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
} as const;

export type FontWeightToken = keyof typeof fontWeight;

/**
 * Semantic roles. `family` already carries the weight; `weight` is there
 * for web, where it keeps synthetic bolding off.
 */
export const typeRole = {
  display: { size: 48, lineHeight: 48, family: fontFamily.displayHero, weight: fontWeight.extrabold }, // hero line
  heading: { size: 30, lineHeight: 34, family: fontFamily.display, weight: fontWeight.bold }, // screen titles
  title: { size: 20, lineHeight: 26, family: fontFamily.display, weight: fontWeight.bold }, // section/card titles
  body: { size: 15, lineHeight: 22, family: fontFamily.sans, weight: fontWeight.regular }, // default text
  label: { size: 14, lineHeight: 20, family: fontFamily.sansSemibold, weight: fontWeight.semibold }, // form labels, buttons
  caption: { size: 12, lineHeight: 16, family: fontFamily.sansMedium, weight: fontWeight.medium }, // secondary detail
  overline: {
    size: 11,
    lineHeight: 16,
    family: fontFamily.sansBold,
    weight: fontWeight.bold,
    letterSpacing: 0.9,
    uppercase: true,
  }, // eyebrow / section labels
} as const;

export type TypeRoleToken = keyof typeof typeRole;
