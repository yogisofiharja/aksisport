import { View, Text } from 'react-native';

/**
 * Promoted from components/ui/badge.tsx in Phase 3, reported then as
 * "already correctly built" — unverified at the time, like EmptyState and
 * ClubCard's typography turned out to be. None of its five actions had any
 * dark-mode variant at all. Phase 6 gave `muted` its first real consumer
 * (SessionCard's status pill) and its real evidence: the original is
 * `bg-surface-sunken dark:bg-surface-sunken-dark` / `text-ink-muted dark:text-ink-muted-dark`,
 * not the gray-family, light-only colors this had. Fixed to match exactly.
 *
 * success/error gained dark-mode variants when SessionCard started
 * color-coding capacity (v0.6.3); warning/info gained theirs when
 * SessionCard started color-coding Session status (v0.7.1) — all four
 * follow the same bg-*-900/20-or-30 + text-*-300-or-400 idiom verified
 * against SessionDetailScreen's existing draft (amber) / cancelled (red)
 * banners.
 */

type Action = 'success' | 'heat' | 'error' | 'info' | 'muted';

const actionClasses: Record<Action, { bg: string; text: string }> = {
  success: { bg: 'bg-success-tint dark:bg-success-tint-dark', text: 'text-success dark:text-success-dark' },
  // Something to notice (a Draft, a full Session, a no-show): quiet brand.
  // The palette has no warning colour.
  heat: { bg: 'bg-heat-tint dark:bg-heat-tint-dark', text: 'text-heat-strong dark:text-heat-strong-dark' },
  error: { bg: 'bg-danger-tint dark:bg-danger-tint-dark', text: 'text-danger dark:text-danger-dark' },
  info: { bg: 'bg-info-tint dark:bg-info-tint-dark', text: 'text-info dark:text-info-dark' },
  muted: { bg: 'bg-surface-sunken dark:bg-surface-sunken-dark', text: 'text-ink-muted dark:text-ink-muted-dark' },
};

export type BadgeAction = Action;

type BadgeProps = { action?: Action; text: string; className?: string };

export function Badge({ action = 'muted', text, className = '' }: BadgeProps) {
  const { bg, text: textClass } = actionClasses[action];
  return (
    <View className={`${bg} rounded-full px-3 py-1 ${className}`}>
      <Text className={`${textClass} text-xs font-sans-bold`}>{text}</Text>
    </View>
  );
}
