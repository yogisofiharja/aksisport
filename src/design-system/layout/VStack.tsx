import { View, type ViewProps } from 'react-native';
import { spacing, type SpacingToken } from '../foundation/spacing';

/**
 * Vertical layout. A distinct primitive from Stack, not an alias — see
 * docs/architecture/LAYOUT_SYSTEM.md and the Phase 1 review that resolved
 * this exact question. Use VStack when writing a vertical group alongside
 * an HStack improves readability; Stack otherwise.
 *
 * No default alignment (matches components/ui/box.tsx's existing VStack,
 * which this primitive is the eventual replacement for).
 */

type VStackProps = ViewProps & { className?: string; space?: SpacingToken };

export function VStack({ className = '', space = 'lg', style, ...props }: VStackProps) {
  return (
    <View
      className={className}
      style={[{ flexDirection: 'column', gap: spacing[space] }, style]}
      {...props}
    />
  );
}
