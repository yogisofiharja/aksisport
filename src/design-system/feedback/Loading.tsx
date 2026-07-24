import { ActivityIndicator, View } from 'react-native';
import { Stack } from '../layout/Stack';
import { Typography } from '../ui/Typography';

/**
 * Collapses both loading-state flavors found in the app: a full-screen
 * centered spinner (4 screens, e.g. ClubDetailScreen while loading) and a
 * smaller inline spinner within scrollable content (3 screens, e.g.
 * ClubListScreen's `py-10` block while the list refreshes).
 *
 * `fullScreen` fills available space (`flex-1`) — it does not render its
 * own SafeAreaView/background; place it inside a Phase 2 `Page`, which
 * already owns that shell, rather than duplicating it here.
 */

type LoadingProps = {
  fullScreen?: boolean;
  label?: string;
};

export function Loading({ fullScreen = false, label }: LoadingProps) {
  return (
    <View className={fullScreen ? 'flex-1 items-center justify-center' : 'items-center py-10'}>
      <Stack space="md" style={{ alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        {label && (
          <Typography variant="body" color="muted">
            {label}
          </Typography>
        )}
      </Stack>
    </View>
  );
}
