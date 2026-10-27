import { forwardRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { spacing, type SpacingToken } from '../foundation/spacing';
import { Container } from './Container';
import { Stack } from './Stack';

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
 * Horizontal padding and inter-child spacing are delegated to Container and
 * Stack respectively, not duplicated here — matches LAYOUT_SYSTEM.md's
 * documented hierarchy (Page → Section → Container → Stack → Content).
 * An earlier version applied `paddingHorizontal` directly in
 * `contentContainerStyle`, a second, undelegated source of the same value
 * Container already owns — fixed in the pre-Phase-6 audit. The ScrollView's
 * own contentContainerStyle now only handles top/bottom scroll-edge
 * padding, which is genuinely its own concern (nothing else owns scroll
 * insets).
 *
 * Default gap matches the app's single most common wrapper
 * (`px-5 pt-4 pb-6 gap-5`, 7 of 11 screens using this exact shape).
 */

type ScrollPageProps = Omit<ScrollViewProps, 'contentContainerStyle'> & {
  className?: string;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardAvoiding?: boolean;
  gap?: SpacingToken;
  /** The screen's AppBar: stays put above the scrolling content. */
  appBar?: ReactNode;
  /** Safe-area edges; a screen above a tab bar leaves out 'bottom'. */
  edges?: Edge[];
};

export const ScrollPage = forwardRef<ScrollView, ScrollPageProps>(function ScrollPage(
  {
    className = '',
    contentContainerStyle,
    keyboardAvoiding = false,
    keyboardShouldPersistTaps,
    gap = 'xl',
    appBar,
    edges,
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
        { paddingTop: spacing.lg, paddingBottom: spacing['2xl'] },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? (keyboardAvoiding ? 'handled' : undefined)}
      {...props}
    >
      <Container>
        <Stack space={gap}>{children}</Stack>
      </Container>
    </ScrollView>
  );

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-ground dark:bg-ground-dark">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {appBar}
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
