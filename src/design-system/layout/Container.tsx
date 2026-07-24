import { View, type ViewProps } from 'react-native';
import { spacing } from '../foundation/spacing';

/**
 * Horizontal constraint. Responsible for consistent page width and padding
 * — LAYOUT_SYSTEM.md: "Cards should never define page spacing... the Page
 * controls external spacing." Default horizontal padding matches the app's
 * existing dominant value (`px-5` = 20px = spacing.xl).
 *
 * The single source of horizontal page padding — ScrollPage composes this
 * internally rather than applying an equivalent value of its own (an
 * earlier version duplicated it; fixed in the pre-Phase-6 audit). A
 * non-scrolling Page composes it directly: `<Page><Container>...</Container></Page>`.
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
