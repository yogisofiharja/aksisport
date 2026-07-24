import { View, Text } from 'react-native';

/**
 * Promoted from components/ui/badge.tsx in Phase 3, reported then as
 * "already correctly built" — unverified at the time, like EmptyState and
 * ClubCard's typography turned out to be. None of its five actions had any
 * dark-mode variant at all. Phase 6 gave `muted` its first real consumer
 * (SessionCard's status pill) and its real evidence: the original is
 * `bg-slate-100 dark:bg-slate-700` / `text-slate-600 dark:text-slate-300`,
 * not the gray-family, light-only colors this had. Fixed to match exactly.
 *
 * success/warning/error/info remain unfixed — no real screen has used them
 * yet, so there's no evidence to fix them against; inventing dark-mode
 * colors for them now would be speculative rather than verified.
 */

type Action = 'success' | 'warning' | 'error' | 'info' | 'muted';

const actionClasses: Record<Action, { bg: string; text: string }> = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  error: { bg: 'bg-red-100', text: 'text-red-700' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700' },
  muted: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
};

type BadgeProps = { action?: Action; text: string; className?: string };

export function Badge({ action = 'muted', text, className = '' }: BadgeProps) {
  const { bg, text: textClass } = actionClasses[action];
  return (
    <View className={`${bg} rounded-full px-3 py-1 ${className}`}>
      <Text className={`${textClass} text-xs font-bold`}>{text}</Text>
    </View>
  );
}
