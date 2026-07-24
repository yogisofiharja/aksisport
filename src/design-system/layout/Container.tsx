import { View, type ViewProps } from 'react-native';
import { spacing } from '../foundation/spacing';

/**
 * Horizontal constraint. Responsible for consistent page width and padding
 * — LAYOUT_SYSTEM.md: "Cards should never define page spacing... the Page
 * controls external spacing." Default horizontal padding matches the app's
 * existing dominant value (`px-5` = 20px = spacing.xl).
 *
 * No max-width cap is applied — there is no documented tablet/wide-screen
 * stance yet (flagged as a gap in the architecture review), so one isn't
 * invented here.
 */

type ContainerProps = ViewProps & { className?: string };

export function Container({ className = '', style, ...props }: ContainerProps) {
  return (
    <View
      className={className}
      style={[{ paddingHorizontal: spacing.xl }, style]}
      {...props}
    />
  );
}
