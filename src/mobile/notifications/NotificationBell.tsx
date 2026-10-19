import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../design-system/ui/Icon';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';
import { getUnreadNotificationCount } from '../../core/notifications/api';
import { useLiveConnected, useLiveEvents } from '../../core/live/live';

type Props = {
  onPress: () => void;
};

const REFRESH_MS = 60_000;

// The bell (DP-018): opens the Notifications page and shows how many are
// unread. Re-counted whenever its screen comes back into view, the moment
// a notification arrives over the live connection (DP-021), and once a
// minute while that connection is down.
export function NotificationBell({ onPress }: Props) {
  const { t } = useTranslation();
  const [unread, setUnread] = useState(0);
  const [focused, setFocused] = useState(false);
  const connected = useLiveConnected();

  const refresh = useCallback(() => {
    getUnreadNotificationCount()
      .then(({ count }) => setUnread(count))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      setFocused(true);
      return () => setFocused(false);
    }, [refresh])
  );

  useEffect(() => {
    if (!focused || connected) return;
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [focused, connected, refresh]);

  useLiveEvents((e) => {
    if (e.type === 'notification.created') refresh();
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="p-2 -mr-2 active:opacity-60"
      accessibilityLabel={unread > 0 ? t('notificationsBellUnread', unread) : t('notificationsTitle')}
    >
      <Icon name={unread > 0 ? 'notifications' : 'notifications-outline'} size="lg" />
      {unread > 0 && (
        <View
          className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-heat items-center justify-center"
          pointerEvents="none"
        >
          <Typography variant="body" className="text-[10px] font-sans-bold text-on-heat">
            {unread > 9 ? '9+' : String(unread)}
          </Typography>
        </View>
      )}
    </Pressable>
  );
}
