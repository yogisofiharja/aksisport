import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect, useLinkTo } from '@react-navigation/native';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../core/notifications/api';
import { notificationIcon, notificationText, timeAgo } from '../../core/notifications/text';
import { enablePush, getPushState, type PushState } from '../../platform/push';
import type { AppNotification } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Alert } from '../../design-system/feedback/Alert';

type Props = {
  onBack: () => void;
};

// The Notifications page (DP-018): every notification the person has had,
// newest first, unread ones marked — so a push that was dismissed or never
// arrived is not lost. Opening one goes where it is about and marks it
// read. Separate from Inbox, which is for conversations.
export function NotificationsScreen({ onBack }: Props) {
  const { t, lang } = useTranslation();
  const linkTo = useLinkTo();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pushState, setPushState] = useState<PushState>(getPushState());
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listNotifications());
    } catch {
      // keep what's showing; pull to refresh retries
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      setPushState(getPushState());
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function open(item: AppNotification) {
    if (!item.readAt) {
      const now = new Date().toISOString();
      setItems((list) => list?.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)) ?? null);
      markNotificationRead(item.id).catch(() => {});
    }
    linkTo(item.path);
  }

  async function markAll() {
    const now = new Date().toISOString();
    setItems((list) => list?.map((n) => (n.readAt ? n : { ...n, readAt: now })) ?? null);
    markAllNotificationsRead().catch(() => load());
  }

  async function turnOnPush() {
    if (enabling) return;
    setEnabling(true);
    try {
      setPushState(await enablePush(lang));
    } catch {
      setPushState(getPushState());
    } finally {
      setEnabling(false);
    }
  }

  const hasUnread = items?.some((n) => !n.readAt) ?? false;

  const unread = items?.filter((n) => !n.readAt) ?? [];
  const earlier = items?.filter((n) => n.readAt) ?? [];

  function row(item: AppNotification) {
    const isUnread = !item.readAt;
    return (
      <ListRow
        key={item.id}
        icon={notificationIcon(item.type)}
        iconTone={isUnread ? 'heat' : 'neutral'}
        title={notificationText(item, t)}
        titleLines={3}
        strong={isUnread}
        meta={timeAgo(item.createdAt, t)}
        trailing={isUnread ? <View className="w-2 h-2 rounded-full bg-heat" accessibilityLabel={t('notificationsUnread')} /> : undefined}
        onPress={() => open(item)}
      />
    );
  }

  return (
    <ScrollPage
      gap="md"
      appBar={
        <AppBar
          title={t('notificationsTitle')}
          onBack={onBack}
          textAction={hasUnread ? { label: t('notificationsMarkAllRead'), onPress: markAll } : undefined}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {pushState === 'default' && (
        <Alert icon="notifications-outline" title={t('pushTurnOnTitle')} actionLabel={t('pushTurnOn')} onAction={enabling ? undefined : turnOnPush}>
          {t('pushTurnOnDesc')}
        </Alert>
      )}
      {pushState === 'denied' && <Alert icon="notifications-off-outline" title={t('pushBlocked')} />}

      {items === null ? null : items.length === 0 ? (
        <EmptyState message={t('notificationsEmpty')} />
      ) : (
        <>
          {unread.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('notificationsUnreadGroup', unread.length)}
              </Typography>
              <ListGroup>{unread.map(row)}</ListGroup>
            </VStack>
          )}
          {earlier.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('notificationsEarlier')}
              </Typography>
              <ListGroup>{earlier.map(row)}</ListGroup>
            </VStack>
          )}
        </>
      )}
    </ScrollPage>
  );
}
