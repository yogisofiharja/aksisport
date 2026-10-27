import type { ReactElement } from 'react';
import { useColorScheme } from 'nativewind';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { color } from '../foundation/colors';

/**
 * Spot illustrations for empty, success and waiting states (Aksi Sport ›
 * Illustration), drawn only from the brand's shapes: heat-tint blocks,
 * heat bars leaning at 33°, one optic-yellow ball and ink lines. Each is a
 * 160 × 120 drawing filled from the theme, so one component covers both
 * themes. Decorative: it always sits above a title that says the same
 * thing, so it is hidden from screen readers.
 */

export type IllustrationName =
  | 'no-sessions'
  | 'no-messages'
  | 'no-results'
  | 'no-notifications'
  | 'offline'
  | 'success'
  | 'pending'
  | 'match-won'
  | 'no-members'
  | 'email';

type Palette = { heat: string; tint: string; ball: string; ink: string; sunken: string };

const ART: Record<IllustrationName, (c: Palette) => ReactElement> = {
  // Confirm your email: an envelope with the heat cut and the ball.
  email: (c) => (
    <>
      <Rect x={6} y={30} width={120} height={80} rx={12} fill={c.tint} />
      <Path d="M6 42 66 80 126 42" fill="none" stroke={c.ink} strokeWidth={6} strokeLinejoin="round" />
      <Polygon points="96,110 116,110 152,54 132,54" fill={c.heat} />
      <Circle cx={140} cy={26} r={11} fill={c.ball} />
    </>
  ),
  'no-sessions': (c) => (
    <>
      <Rect x={0} y={40} width={92} height={66} rx={12} fill={c.tint} />
      <Polygon points="64,106 90,106 134,40 108,40" fill={c.heat} />
      <Polygon points="102,106 122,106 160,48 140,48" fill={c.heat} />
      <Circle cx={32} cy={22} r={13} fill={c.ball} />
    </>
  ),
  'no-messages': (c) => (
    <>
      <Rect x={6} y={14} width={92} height={50} rx={14} fill={c.sunken} />
      <Polygon points="20,62 40,62 16,80" fill={c.sunken} />
      <Rect x={58} y={52} width={96} height={48} rx={14} fill={c.tint} />
      <Polygon points="128,98 148,98 154,114" fill={c.tint} />
      <Circle cx={88} cy={76} r={5} fill={c.heat} />
      <Circle cx={106} cy={76} r={5} fill={c.heat} />
      <Circle cx={124} cy={76} r={5} fill={c.heat} />
      <Polygon points="26,46 36,46 52,26 42,26" fill={c.heat} />
      <Polygon points="44,46 54,46 70,26 60,26" fill={c.heat} />
    </>
  ),
  'no-results': (c) => (
    <>
      <Rect x={44} y={34} width={110} height={78} rx={12} fill={c.tint} />
      <Circle cx={62} cy={52} r={30} fill="none" stroke={c.ink} strokeWidth={10} />
      <Polygon points="80,76 94,68 128,108 114,116" fill={c.heat} />
      <Circle cx={142} cy={18} r={10} fill={c.ball} />
    </>
  ),
  'no-notifications': (c) => (
    <>
      <Rect x={16} y={28} width={128} height={84} rx={12} fill={c.tint} />
      <Path d="M56 86 V58 a24 24 0 0 1 48 0 V86 l10 10 H46 z" fill={c.heat} />
      <Circle cx={80} cy={104} r={7} fill={c.ink} />
      <Rect x={76} y={20} width={8} height={14} rx={4} fill={c.ink} />
      <Circle cx={122} cy={26} r={8} fill={c.ball} />
    </>
  ),
  offline: (c) => (
    <>
      <Rect x={0} y={52} width={160} height={6} rx={3} fill={c.ink} />
      <Rect x={10} y={30} width={6} height={58} rx={3} fill={c.ink} />
      <Rect x={144} y={30} width={6} height={58} rx={3} fill={c.ink} />
      <Polygon points="34,50 52,50 74,16 56,16" fill={c.heat} />
      <Polygon points="82,104 100,104 122,70 104,70" fill={c.heat} />
      <Rect x={24} y={92} width={44} height={24} rx={8} fill={c.tint} />
      <Circle cx={130} cy={106} r={10} fill={c.ball} />
    </>
  ),
  success: (c) => (
    <>
      <Rect x={20} y={18} width={120} height={96} rx={20} fill={c.tint} />
      <Polygon points="40,66 56,54 80,82 66,94" fill={c.heat} />
      <Polygon points="66,94 80,82 128,30 112,24" fill={c.heat} />
      <Circle cx={140} cy={16} r={9} fill={c.ball} />
      <Circle cx={18} cy={104} r={5} fill={c.heat} />
    </>
  ),
  pending: (c) => (
    <>
      <Rect x={0} y={62} width={70} height={50} rx={12} fill={c.tint} />
      <Circle cx={96} cy={58} r={44} fill={c.sunken} />
      <Path d="M96 14 a44 44 0 0 1 44 44" fill="none" stroke={c.heat} strokeWidth={10} strokeLinecap="round" />
      <Rect x={92} y={32} width={8} height={30} rx={4} fill={c.ink} />
      <Rect x={92} y={54} width={28} height={8} rx={4} fill={c.ink} />
      <Circle cx={96} cy={58} r={6} fill={c.ball} />
    </>
  ),
  'match-won': (c) => (
    <>
      <Rect x={10} y={66} width={44} height={50} rx={8} fill={c.sunken} />
      <Path d="M58 116 V56 L102 30 V116 Z" fill={c.heat} />
      <Rect x={106} y={80} width={44} height={36} rx={8} fill={c.tint} />
      <Circle cx={128} cy={66} r={12} fill={c.ball} />
      <Polygon points="20,40 28,40 40,22 32,22" fill={c.heat} />
    </>
  ),
  'no-members': (c) => (
    <>
      <Rect x={0} y={70} width={160} height={46} rx={12} fill={c.tint} />
      <Circle cx={34} cy={56} r={22} fill={c.sunken} />
      <Circle cx={80} cy={50} r={26} fill={c.ink} />
      <Circle cx={128} cy={56} r={22} fill="none" stroke={c.heat} strokeWidth={4} strokeDasharray="8 6" />
      <Rect x={125} y={44} width={6} height={24} rx={3} fill={c.heat} />
      <Rect x={116} y={53} width={24} height={6} rx={3} fill={c.heat} />
      <Circle cx={80} cy={16} r={9} fill={c.ball} />
    </>
  ),
};

type IllustrationProps = {
  name: IllustrationName;
  /** Width in px; height follows the 4:3 drawing. 120 in an EmptyState, up to 160 on a confirmation. */
  width?: number;
};

export function Illustration({ name, width = 120 }: IllustrationProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette: Palette = {
    heat: color.heat[mode],
    tint: color.heatTint[mode],
    ball: color.ball[mode],
    ink: color.ink[mode],
    sunken: color.surfaceSunken[mode],
  };
  return (
    <Svg
      width={width}
      height={(width * 3) / 4}
      viewBox="0 0 160 120"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {ART[name](palette)}
    </Svg>
  );
}
