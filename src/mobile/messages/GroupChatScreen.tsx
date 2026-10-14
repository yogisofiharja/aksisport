import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { usePollInterval, useLiveEvents } from '../../core/live/live';
import { conversationImageUrl, getGroup, listGroupMessages, sendGroupMessage } from '../../core/messages/groups';
import { ConversationThread } from '../sessions/ConversationThread';
import type { ConversationMessage, GroupChat } from '../../core/api/types';

type Props = {
  groupId: string;
  onBack: () => void;
  onOpenInfo: (groupId: string) => void;
};

// A group chat (DP-021): same thread as every other chat; the header
// opens the group's info (people, rename, add, leave).
export function GroupChatScreen({ groupId, onBack, onOpenInfo }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  // Not in this group (removed, left, or never): nothing to show.
  const [gone, setGone] = useState(false);

  const loadGroup = useCallback(() => {
    getGroup(groupId)
      .then((g) => {
        setGroup(g);
        setGone(false);
      })
      .catch(() => setGone(true));
  }, [groupId]);

  const load = useCallback(async () => {
    try {
      setMessages(await listGroupMessages(groupId));
    } catch {
      // stays stale; the group check above says if we were removed
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const pollInterval = usePollInterval();
  useEffect(() => {
    load();
    const interval = setInterval(load, pollInterval);
    return () => clearInterval(interval);
  }, [load, pollInterval]);

  useLiveEvents((e) => {
    if (e.data?.conversationId !== groupId) return;
    if (e.type === 'group.updated') loadGroup();
    // Before the first message there is no conversation on screen for
    // ConversationThread to match.
    if (e.type === 'message.created' && messages.length === 0) load();
  });

  async function handleSend(body: string, image?: { base64: string; contentType: string }) {
    const message = await sendGroupMessage(groupId, { body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <HStack className="items-center px-4 pt-3 pb-3 border-b border-slate-200 dark:border-slate-800" space="sm">
        <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <Pressable className="flex-row items-center gap-3 active:opacity-70" style={{ flex: 1 }} onPress={() => group && onOpenInfo(groupId)}>
          <View className="w-9 h-9 rounded-full items-center justify-center bg-blue-100 dark:bg-blue-900">
            <Icon name="people" size="sm" color="secondary" />
          </View>
          <VStack style={{ flex: 1 }}>
            <Typography variant="body" className="font-bold" numberOfLines={1}>
              {group?.title ?? ''}
            </Typography>
            {group && (
              <Typography variant="body" color="muted" className="text-xs">
                {t('groupMemberCount', group.members.length)}
              </Typography>
            )}
          </VStack>
        </Pressable>
      </HStack>

      {gone ? (
        <Typography variant="body" color="muted" className="px-5 pt-6">
          {t('groupUnavailable')}
        </Typography>
      ) : (
        <View style={{ flex: 1 }}>
          <ConversationThread
            imageUrl={conversationImageUrl}
            messages={messages}
            loading={loading}
            onRefresh={load}
            myUserId={me?.id ?? ''}
            canPost
            closedNotice=""
            emptyText={t('groupEmpty')}
            placeholder={t('sessionChatPlaceholder')}
            onSend={handleSend}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
