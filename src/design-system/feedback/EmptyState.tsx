import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Stack } from '../layout/Stack';
import { Typography } from '../ui/Typography';

/**
 * Collapses the app's existing empty-state pattern into one component.
 *
 * Verified against all four real call sites (ClubListScreen,
 * SessionListScreen, SessionDetailScreen, AddMatchScreen) during Phase 6:
 * every one is a plain, unwrapped muted text line — no centering, no
 * padding. An earlier version of this component wrapped everything in
 * `items-center py-10` unconditionally, which didn't match any of them
 * (likely pattern-matched against the neighboring loading-spinner block
 * instead of the actual empty-state markup). Fixed here, caught by needing
 * byte-level fidelity for a real migration rather than by inspection.
 *
 * `<EmptyState message="..." />` (no icon/action) now renders exactly as
 * every real call site does today. The centered/padded layout only applies
 * when `icon` or `action` is actually used — a real, opt-in richer shape,
 * not the default.
 */

type EmptyStateProps = ViewProps & {
  className?: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ className = '', message, icon, action, ...props }: EmptyStateProps) {
  if (!icon && !action) {
    return (
      <Typography variant="body" color="muted" className={className} {...props}>
        {message}
      </Typography>
    );
  }

  return (
    <View className={`items-center py-10 ${className}`} {...props}>
      <Stack space="md" style={{ alignItems: 'center' }}>
        {icon}
        <Typography variant="body" color="muted" style={{ textAlign: 'center' }}>
          {message}
        </Typography>
        {action}
      </Stack>
    </View>
  );
}
