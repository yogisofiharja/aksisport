import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

/**
 * Every screen should begin with a Page — LAYOUT_SYSTEM.md: responsible for
 * Safe Area, Status Bar, Background, Screen padding (keyboard handling is
 * ScrollPage's concern, since it only matters where there's scrollable
 * form content).
 *
 * Background uses the literal `bg-slate-50 dark:bg-slate-900` NativeWind
 * classes, not foundation/colors.ts's JS token values — this is a
 * className-context consumer, and that pair is Tailwind's own default
 * palette (the same data colors.ts's Tier 2 imports from `tailwindcss/colors`
 * for JS contexts). Using the className directly avoids inline-style
 * recalculation and gets NativeWind's automatic dark-mode media query
 * switching for free, matching every existing screen's pattern exactly.
 *
 * No horizontal padding by default — compose with Container for that.
 */

type PageProps = ViewProps & { className?: string };

export const Page = forwardRef<View, PageProps>(function Page({ className = '', style, children, ...props }, ref) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View ref={ref} className={`flex-1 bg-slate-50 dark:bg-slate-900 ${className}`} style={style} {...props}>
      <SafeAreaView className="flex-1">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </SafeAreaView>
    </View>
  );
});
