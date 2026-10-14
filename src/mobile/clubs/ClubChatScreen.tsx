import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { usePollInterval, useLiveEvents } from '../../core/live/live';
import { getClub, listMembers } from '../../core/clubs/api';
import {
  conversationImageUrl,
  getClubChat,
  listClubChatMessages,
  removeClubChatMessage,
  sendClubChatMessage,
  setClubChatEnabled,
} from '../../core/messages/groups';
import { ConversationThread } from '../sessions/ConversationThread';
import type { ConversationMessage } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
};

// A Community's chat (DP-021): every member reads and posts. The owner
// and admins can delete anyone's message and turn the chat off (history
// stays readable). It never sends pushes.
export function ClubChatScreen({ clubId, onBack }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [clubName, setClubName] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClub(clubId)
      .then((c) => setClubName(c.name))
      .catch(() => {});
    listMembers(clubId)
      .then((members) => setIsOrganizer(members.some((m) => m.userId === me?.id && (m.role === 'owner' || m.role === 'admin'))))
      .catch(() => {});
    getClubChat(clubId)
      .then((s) => setEnabled(s.enabled))
      .catch(() => {});
  }, [clubId, me?.id]);

  const load = useCallback(async () => {
    try {
      setMessages(await listClubChatMessages(clubId));
    } catch {
      // stays stale
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  const pollInterval = usePollInterval();
  useEffect(() => {
    load();
    const interval = setInterval(load, pollInterval);
    return () => clearInterval(interval);
  }, [load, pollInterval]);

  useLiveEvents((e) => {
    if (e.type === 'club.chat.updated' && e.data?.clubId === clubId) setEnabled(!!e.data.enabled);
    if (e.type === 'message.created' && e.data?.kind === 'club' && e.data?.clubId === clubId && messages.length === 0) load();
  });

  async function handleSend(body: string, image?: { base64: string; contentType: string }) {
    const message = await sendClubChatMessage(clubId, { body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  function handleMenu() {
    appAlert(t('clubChatTitle'), undefined, [
      {
        text: enabled ? t('clubChatTurnOff') : t('clubChatTurnOn'),
        style: enabled ? 'destructive' : 'default',
        onPress: () =>
          setClubChatEnabled(clubId, !enabled)
            .then(() => setEnabled(!enabled))
            .catch(() => appAlert(t('reportActionFailed'))),
      },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <HStack className="items-center px-4 pt-3 pb-3 border-b border-slate-200 dark:border-slate-800" space="sm">
        <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <VStack style={{ flex: 1 }}>
          <Typography variant="body" className="font-bold" numberOfLines={1}>
            {t('clubChatTitle')}
          </Typography>
          <Typography variant="body" color="muted" className="text-xs" numberOfLines={1}>
            {clubName}
          </Typography>
        </VStack>
        {isOrganizer && (
          <Pressable className="p-2 -mr-2 active:opacity-60" onPress={handleMenu} hitSlop={4}>
            <Icon name="ellipsis-vertical" size="lg" />
          </Pressable>
        )}
      </HStack>

      <View style={{ flex: 1 }}>
        <ConversationThread
          imageUrl={conversationImageUrl}
          messages={messages}
          loading={loading}
          onRefresh={load}
          myUserId={me?.id ?? ''}
          canPost={enabled}
          closedNotice={isOrganizer ? t('clubChatOffOrganizer') : t('clubChatOff')}
          emptyText={t('clubChatEmpty')}
          placeholder={t('sessionChatPlaceholder')}
          onSend={handleSend}
          onModeratorRemove={isOrganizer ? (messageId) => removeClubChatMessage(clubId, messageId) : undefined}
        />
      </View>
    </SafeAreaView>
  );
}
