import { View, type ViewProps } from 'react-native';
import { spacing, type SpacingToken } from '../foundation/spacing';

/**
 * Default layout primitive. Responsible for vertical spacing —
 * LAYOUT_SYSTEM.md: "Avoid manually adding margins between children."
 * Gap is sourced from foundation spacing tokens (single source of truth),
 * not a hand-picked NativeWind gap-N class.
 */

type StackProps = ViewProps & { className?: string; space?: SpacingToken };

export function Stack({ className = '', space = 'lg', style, ...props }: StackProps) {
  return (
    <View
      className={className}
      style={[{ flexDirection: 'column', gap: spacing[space] }, style]}
      {...props}
    />
  );
}
