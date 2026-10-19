import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Stack } from '../layout/Stack';
import { Typography } from '../ui/Typography';
import { Illustration, type IllustrationName } from './Illustration';

/**
 * Empty state (Aksi Sport › EmptyState).
 *
 * Default: the app's plain muted line, unwrapped — what every list shows
 * today (`<EmptyState message="No sessions yet" />`).
 *
 * With `illustration`: the centred layout — the art at 120 × 90, a title
 * in the display face ("No sessions yet"), one sentence on what to do
 * (`message`) and at most one action. If the viewer can't act, pass no
 * action. Search with no results stays quiet: use the default, not art.
 *
 * `icon` / `action` without art keep the older centred variant.
 */

type EmptyStateProps = ViewProps & {
  className?: string;
  message: string;
  title?: string;
  illustration?: IllustrationName;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ className = '', message, title, illustration, icon, action, ...props }: EmptyStateProps) {
  if (illustration) {
    return (
      <View className={`items-center px-6 py-10 ${className}`} {...props}>
        <Illustration name={illustration} />
        {title ? (
          <Typography variant="title" className="font-display-hero text-center mt-4">
            {title}
          </Typography>
        ) : null}
        <Typography variant="body" color="muted" className="text-center mt-1.5 max-w-[300px]">
          {message}
        </Typography>
        {action ? <View className="mt-5 self-stretch items-center">{action}</View> : null}
      </View>
    );
  }

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
