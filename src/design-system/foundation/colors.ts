/**
 * Semantic colour tokens for JS-side use (icon colours, navigator options,
 * `ActivityIndicator`, anything that takes a colour value rather than a
 * className). Every value comes from ./tokens/colors, the same file
 * tailwind.config.js turns into classes, so `color.heat` here and `bg-heat`
 * there are always the same colour.
 */

import palette from './tokens/colors';

export type ThemeColor = { light: string; dark: string };
type PaletteName = keyof typeof palette;

export const color: Record<PaletteName, ThemeColor> = palette;

export type ColorToken = typeof color;
export type ColorName = PaletteName;
