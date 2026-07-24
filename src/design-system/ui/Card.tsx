import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, type ElevationToken } from '../foundation/elevation';
import { spacing, type SpacingToken } from '../foundation/spacing';

/**
 * Collapses the 6 hand-typed `bg-white dark:bg-slate-800 rounded-2xl...`
 * variants found across the app into one component with props.
 *
 * Deliberately has no header/footer/title slots — LAYOUT_SYSTEM.md keeps
 * that grouping concern in Section (Phase 2), which already exists.
 * Compose: `<Card><Section title="...">...</Section></Card>`.
 *
 * Always renders RN's Pressable as the base element, even when non-
 * interactive — a static Pressable behaves identically to a View with no
 * handlers attached. This replaced an earlier version with a discriminated
 * `pressable?: false | true` union: it looked cleaner in isolation, but
 * broke the moment a caller needed `pressable={Boolean(onPress)}` — a
 * dynamic value, not a literal — which is exactly what every Phase 5
 * Domain UI card needs (press behavior conditional on whether the screen
 * passes a handler). Found and fixed while building on top of it, not
 * revisited speculatively.
 */

type CardProps = PressableProps & {
  className?: string;
  padding?: SpacingToken | 'none';
  bordered?: boolean;
  elevated?: ElevationToken;
  pressable?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  className = '',
  padding = 'lg',
  bordered = false,
  elevated = 'none',
  pressable = false,
  style,
  ...props
}: CardProps) {
  const paddingStyle = padding === 'none' ? undefined : { padding: spacing[padding] };
  const borderClass = bordered ? 'border border-slate-100 dark:border-slate-700' : '';
  const pressClass = pressable ? 'active:opacity-70' : '';

  return (
    <Pressable
      className={`bg-white dark:bg-slate-800 rounded-2xl ${pressClass} ${borderClass} ${className}`}
      style={[paddingStyle, elevation[elevated], style]}
      {...props}
    />
  );
}
