/**
 * Elevation — semantic shadow scale (DESIGN_TOKENS.md: none/low/medium/high).
 * Values mirror Tailwind's default `shadow-*` scale so no new build-time
 * config is needed later. Only `low` (Tailwind's `shadow-sm`) is in live use
 * today (4 call sites); `medium`/`high` complete the documented scale ahead
 * of need, matching Tailwind's own built-in steps rather than inventing new
 * values.
 *
 * Expressed as raw React Native shadow props (not just a className string)
 * since elevation is one of the values consumers may need outside a
 * NativeWind class context, same rationale as colors.ts.
 */

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number; // Android
};

export const elevation: Record<'none' | 'low' | 'medium' | 'high', ShadowStyle> = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  low: {
    // Tailwind `shadow-sm`
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    // Tailwind `shadow-md`
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  high: {
    // Tailwind `shadow-lg`
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
};

export type ElevationToken = keyof typeof elevation;
