import { Pressable, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { elevation, type ElevationToken } from '../foundation/elevation';
import { spacing, type SpacingToken } from '../foundation/spacing';

/**
 * Collapses the 6 hand-typed `bg-white dark:bg-slate-800 rounded-2xl...`
 * variants found across the app into one component with props.
 *
 * Deliberately has no header/footer/title slots — LAYOUT_SYSTEM.md keeps
 * that grouping concern in Section (Phase 2), which already exists.
 * Compose: `<Card><Section title="...">...</Section></Card>`.
 */

type CardBaseProps = {
  className?: string;
  padding?: SpacingToken | 'none';
  bordered?: boolean;
  elevated?: ElevationToken;
};

// `style` is restricted to the plain form on both branches — Card doesn't
// need Pressable's press-state-driven function style, since press feedback
// is already handled by the `active:opacity-70` className.
type CardProps = CardBaseProps &
  (
    | ({ pressable?: false } & Omit<ViewProps, 'style'>)
    | ({ pressable: true } & Omit<PressableProps, 'style'>)
  ) & { style?: StyleProp<ViewStyle> };

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

  if (pressable) {
    return (
      <Pressable
        className={`bg-white dark:bg-slate-800 rounded-2xl active:opacity-70 ${borderClass} ${className}`}
        style={[paddingStyle, elevation[elevated], style]}
        {...(props as Omit<PressableProps, 'style'>)}
      />
    );
  }

  return (
    <View
      className={`bg-white dark:bg-slate-800 rounded-2xl ${borderClass} ${className}`}
      style={[paddingStyle, elevation[elevated], style]}
      {...(props as Omit<ViewProps, 'style'>)}
    />
  );
}
