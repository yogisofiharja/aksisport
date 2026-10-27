import { forwardRef, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

/**
 * Every screen should begin with a Page — LAYOUT_SYSTEM.md: responsible for
 * Safe Area, Status Bar, Background, Screen padding (keyboard handling is
 * ScrollPage's concern, since it only matters where there's scrollable
 * form content).
 *
 * Background is the `ground` token as classes (`bg-ground
 * dark:bg-ground-dark`), not colors.ts's JS values: a className context,
 * so NativeWind switches it with the theme for free.
 *
 * No horizontal padding by default — compose with Container for that.
 */

type PageProps = ViewProps & {
  className?: string;
  /** The screen's AppBar, at the top of the safe area. */
  appBar?: ReactNode;
  /** Safe-area edges; a screen above a tab bar leaves out 'bottom'. */
  edges?: Edge[];
};

export const Page = forwardRef<View, PageProps>(function Page({ className = '', style, appBar, edges, children, ...props }, ref) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View ref={ref} className={`flex-1 bg-ground dark:bg-ground-dark ${className}`} style={style} {...props}>
      <SafeAreaView edges={edges} className="flex-1">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {appBar}
        {children}
      </SafeAreaView>
    </View>
  );
});
