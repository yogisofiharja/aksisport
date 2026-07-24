import { View, type ViewProps } from 'react-native';
import { spacing, type SpacingToken } from '../foundation/spacing';

/**
 * Horizontal layout. Responsible for spacing between items.
 *
 * Defaults to center alignment, matching components/ui/box.tsx's existing
 * HStack — this primitive is the eventual replacement for it.
 */

type HStackProps = ViewProps & { className?: string; space?: SpacingToken };

export function HStack({ className = '', space = 'lg', style, ...props }: HStackProps) {
  return (
    <View
      className={className}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing[space] }, style]}
      {...props}
    />
  );
}
