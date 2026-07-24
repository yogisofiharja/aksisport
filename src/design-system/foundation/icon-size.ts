/**
 * Icon sizes. Not part of Phase 1 (ROADMAP.md's Phase 1 bullet list didn't
 * include icon sizing) — added now because Phase 3's Icon component
 * genuinely requires it, per DESIGN_SYSTEM.md's Icon guidelines ("Never
 * pass a raw numeric size").
 *
 * Scale reflects the raw sizes actually found across the app's direct
 * Ionicons usage today (24 was the single most common — back buttons,
 * 9 call sites), named per DESIGN_TOKENS.md's xs..xl vocabulary.
 */

export const iconSize = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSizeToken = keyof typeof iconSize;
