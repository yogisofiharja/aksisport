import { View, type ViewProps } from 'react-native';

/**
 * Promoted from components/ui/box.tsx's Divider — horizontal only, matching
 * its only observed use (AddMatchScreen's section separators). No vertical
 * variant: nothing in the app uses one, so none is built speculatively.
 */

type DividerProps = ViewProps & { className?: string };

export function Divider({ className = '', ...props }: DividerProps) {
  return <View className={`h-px bg-border dark:bg-border-dark ${className}`} {...props} />;
}
