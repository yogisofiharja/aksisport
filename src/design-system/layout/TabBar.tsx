import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The app's tab bar (Aksi Sport › TabBar): the personal tabs (Home,
 * Explore, Inbox, Me) as the bottom tab navigator's `tabBar`, and a
 * Community's tabs (Home, Sessions, Chat, Members) through `TabBarView`.
 *
 * Every tab is always labelled. The active tab has an ink label, a
 * heat-strong icon (outline, never switched to filled) and a short heat
 * bar above it leaning at the mark's -10°. An unread count is a heat badge
 * with ink numerals, ringed in `surface`, up to 99 then "99+". Padded by
 * the bottom safe-area inset.
 */

export type TabBarItem = {
  key: string;
  label: string;
  /** Drawn by the caller, given whether the tab is active. */
  icon: (focused: boolean) => ReactNode;
  focused: boolean;
  badge?: number | string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

export function TabBarView({ items }: { items: TabBarItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark"
      style={{ paddingBottom: insets.bottom }}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const { badge, focused } = item;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            onLongPress={item.onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            className="flex-1 items-center pt-2 pb-1.5 active:opacity-70"
          >
            <View
              className={`absolute top-0 h-[3px] w-7 rounded-b-sm ${focused ? 'bg-heat' : 'bg-transparent'}`}
              style={{ transform: [{ skewX: '-10deg' }] }}
            />
            <View>
              {item.icon(focused)}
              {badge !== undefined && badge !== null && badge !== '' && badge !== 0 ? (
                <View className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-heat items-center justify-center border-2 border-surface dark:border-surface-dark">
                  <Text className="text-[10px] font-sans-bold text-on-heat" style={{ fontVariant: ['tabular-nums'] }}>
                    {typeof badge === 'number' && badge > 99 ? '99+' : String(badge)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className={`mt-1 text-[11px] ${
                focused ? 'font-sans-bold text-ink dark:text-ink-dark' : 'font-sans-medium text-ink-muted dark:text-ink-muted-dark'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <TabBarView
      items={state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
        return {
          key: route.key,
          label,
          focused,
          badge: options.tabBarBadge,
          accessibilityLabel: options.tabBarAccessibilityLabel,
          icon: (f) => options.tabBarIcon?.({ focused: f, color: '', size: 24 }),
          onPress: () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          },
          onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
        };
      })}
    />
  );
}
