import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Stack } from '../layout/Stack';
import { Typography } from '../ui/Typography';

/**
 * Collapses the app's existing empty-state pattern — a single muted
 * `<Text>` line, repeated across ClubListScreen, SessionListScreen,
 * SessionDetailScreen, and AddMatchScreen — into one component.
 *
 * `icon`/`action` are optional and additive over what exists today (icons
 * passed as elements, per COMPONENT_STANDARDS.md), not a requirement —
 * `<EmptyState message="..." />` alone matches every current call site
 * exactly.
 */

type EmptyStateProps = ViewProps & {
  className?: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ className = '', message, icon, action, ...props }: EmptyStateProps) {
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
