import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../../i18n';
import { getUnreadNotificationCount } from '../../core/notifications/api';
import { useLiveConnected, useLiveEvents } from '../../core/live/live';
import type { AppBarAction } from '../../design-system/layout/AppBar';

const REFRESH_MS = 60_000;

// The bell (DP-018) as an AppBar action: opens the Notifications page,
// with a heat dot while any are unread. Re-counted whenever its screen
// comes back into view, the moment a notification arrives over the live
// connection (DP-021), and once a minute while that connection is down.
export function useNotificationBell(onPress: () => void): AppBarAction {
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

  return {
    icon: 'notifications-outline',
    label: unread > 0 ? t('notificationsBellUnread', unread) : t('notificationsTitle'),
    onPress,
    dot: unread > 0,
  };
}
