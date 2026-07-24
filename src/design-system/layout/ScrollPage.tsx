import { forwardRef } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { spacing } from '../foundation/spacing';

/**
 * Page + scrolling — LAYOUT_SYSTEM.md: "Use when content may exceed screen
 * height. Avoid nesting multiple scroll views."
 *
 * Covers both scrollable patterns found in the existing app:
 * - form screens (KeyboardAvoidingView + ScrollView, e.g. LoginScreen,
 *   CreateClubScreen) — opt in with `keyboardAvoiding`.
 * - list screens (ScrollView + pull-to-refresh, e.g. ClubListScreen,
 *   SessionListScreen) — pass `refreshControl` straight through to the
 *   underlying ScrollView, no extra API needed.
 *
 * Default content padding matches the app's single most common wrapper
 * (`px-5 pt-4 pb-6 gap-5`, 7 of 11 screens using this exact shape) —
 * sourced from foundation spacing tokens.
 */

type ScrollPageProps = Omit<ScrollViewProps, 'contentContainerStyle'> & {
  className?: string;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardAvoiding?: boolean;
};

export const ScrollPage = forwardRef<ScrollView, ScrollPageProps>(function ScrollPage(
  {
    className = '',
    contentContainerStyle,
    keyboardAvoiding = false,
    keyboardShouldPersistTaps,
    children,
    ...props
  },
  ref
) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const scrollView = (
    <ScrollView
      ref={ref}
      className={className}
      contentContainerStyle={[
        { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing['2xl'], gap: spacing.xl },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? (keyboardAvoiding ? 'handled' : undefined)}
      {...props}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          {scrollView}
        </KeyboardAvoidingView>
      ) : (
        scrollView
      )}
    </SafeAreaView>
  );
});
