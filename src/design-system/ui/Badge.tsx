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
 * success/error gained dark-mode variants when SessionCard started
 * color-coding capacity (v0.6.3); warning/info gained theirs when
 * SessionCard started color-coding Session status (v0.7.1) — all four
 * follow the same bg-*-900/20-or-30 + text-*-300-or-400 idiom verified
 * against SessionDetailScreen's existing draft (amber) / cancelled (red)
 * banners.
 */

type Action = 'success' | 'warning' | 'error' | 'info' | 'muted';

const actionClasses: Record<Action, { bg: string; text: string }> = {
  success: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  warning: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
  error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  info: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  muted: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
};

export type BadgeAction = Action;

type BadgeProps = { action?: Action; text: string; className?: string };

export function Badge({ action = 'muted', text, className = '' }: BadgeProps) {
  const { bg, text: textClass } = actionClasses[action];
  return (
    <View className={`${bg} rounded-full px-3 py-1 ${className}`}>
      <Text className={`${textClass} text-xs font-bold`}>{text}</Text>
    </View>
  );
}
