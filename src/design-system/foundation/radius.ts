/**
 * Corner radius — deliberately minimal. The app has already converged on a
 * single radius value in practice (`rounded-2xl`, 50 uses across every
 * card, button, and input), plus `rounded-full` for pills/badges/the
 * rounded Input variant. DESIGN_TOKENS.md: "consistency more important than
 * variety" — no additional values are defined without a real use.
 */

export const radius = {
  md: 16, // rounded-2xl — the app's dominant, effectively only, radius
  full: 9999, // rounded-full — pills, badges, JoinClub code input
} as const;

export type RadiusToken = keyof typeof radius;
