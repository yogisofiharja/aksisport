import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../foundation/spacing';

/**
 * Used inside dialogs and bottom sheets — LAYOUT_SYSTEM.md: "Provides
 * consistent spacing and safe area."
 *
 * No StatusBar handling here, unlike Page/ScrollPage — a modal is presented
 * on top of a screen that already owns the status bar.
 *
 * Modal/Dialog/BottomSheet components don't exist yet (Phase 4/5), so this
 * is layout scaffolding ahead of them rather than a fit against a proven
 * usage pattern — worth revisiting once one of those consumes it for real.
 */

type ModalPageProps = ViewProps & { className?: string };

export const ModalPage = forwardRef<View, ModalPageProps>(function ModalPage(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <SafeAreaView className="bg-white dark:bg-slate-800">
      <View ref={ref} className={className} style={[{ padding: spacing.xl }, style]} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
});
