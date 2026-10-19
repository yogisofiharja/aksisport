import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Pins a detail screen's one primary action to the bottom (Aksi Sport ›
 * ActionBar), where thumbs reach; it replaces the tab bar on detail
 * screens. `surface` with a hairline top border, padded by the safe-area
 * inset.
 *
 * Left: the deciding fact (price, spots left, start time), its value in
 * the display face. Right: one `lg` primary button — or, with no fact, the
 * button alone, full width. Never two primary buttons. Place it after the
 * screen's ScrollView (inside a KeyboardAvoidingView on forms), so content
 * never hides behind it.
 */

type ActionBarProps = {
  fact?: { label: string; value: string };
  children: ReactNode;
};

export function ActionBar({ fact, children }: ActionBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-4 px-4 pt-3 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {fact ? (
        <View className="flex-1">
          <Text className="text-xs font-sans-medium text-ink-muted dark:text-ink-muted-dark">{fact.label}</Text>
          <Text className="text-xl font-display text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
            {fact.value}
          </Text>
        </View>
      ) : null}
      <View className={fact ? '' : 'flex-1'}>{children}</View>
    </View>
  );
}
