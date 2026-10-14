import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLinkTo } from '@react-navigation/native';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Card } from '../../design-system/ui/Card';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../core/notifications/api';
import { notificationIcon, notificationText, timeAgo } from '../../core/notifications/text';
import { enablePush, getPushState, type PushState } from '../../platform/push';
import type { AppNotification } from '../../core/api/types';

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

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <VStack space="md" className="px-5 pt-4 pb-2">
        <HStack className="justify-between items-center">
          <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>
          {hasUnread && (
            <Pressable onPress={markAll} hitSlop={8} className="active:opacity-60">
              <Typography variant="body" className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {t('notificationsMarkAllRead')}
              </Typography>
            </Pressable>
          )}
        </HStack>
        <Typography variant="display">{t('notificationsTitle')}</Typography>

        {pushState === 'default' && (
          <Card>
            <VStack space="sm">
              <Typography variant="body" className="font-bold">
                {t('pushTurnOnTitle')}
              </Typography>
              <Typography variant="body" color="muted">
                {t('pushTurnOnDesc')}
              </Typography>
              <Button action="secondary" size="lg" className="w-full" onPress={turnOnPush} isDisabled={enabling}>
                <ButtonText>{t('pushTurnOn')}</ButtonText>
              </Button>
            </VStack>
          </Card>
        )}
        {pushState === 'denied' && (
          <Typography variant="body" color="muted" className="text-sm">
            {t('pushBlocked')}
          </Typography>
        )}
      </VStack>

      {items === null ? null : items.length === 0 ? (
        <View className="px-5 pt-4">
          <EmptyState message={t('notificationsEmpty')} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <Pressable
                onPress={() => open(item)}
                className={`px-5 py-4 border-b border-slate-200 dark:border-slate-800 active:opacity-70 ${
                  unread ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                }`}
              >
                <HStack space="md" className="items-start">
                  <View className="w-9 h-9 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-800">
                    <Icon name={notificationIcon(item.type)} size="sm" color={unread ? 'secondary' : 'muted'} />
                  </View>
                  <VStack space="xs" style={{ flex: 1 }}>
                    <Typography variant="body" className={unread ? 'font-bold' : ''}>
                      {notificationText(item, t)}
                    </Typography>
                    <Typography variant="body" color="muted" className="text-xs">
                      {timeAgo(item.createdAt, t)}
                    </Typography>
                  </VStack>
                  {unread && (
                    <View className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-2" accessibilityLabel={t('notificationsUnread')} />
                  )}
                </HStack>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
