import { useCallback, useEffect, useState } from 'react';
import { Modal, RefreshControl, ScrollView } from 'react-native';
import { Icon } from '../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { listContactMessages, listSessionContactThreads, sendContactMessage } from '../../core/sessions/api';
import { initialsFromName } from '../../core/initials';
import { ConversationThread } from './ConversationThread';
import type { ConversationMessage, Session, SessionContactThread } from '../../core/api/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  session: Session;
  isOwnerOrAdmin: boolean;
  myUserId: string;
  // Set when opened from the Inbox (an organizer replying to a specific
  // member) — jumps straight into that thread instead of the list.
  initialMemberUserId?: string;
};

// DP-013 Contact Organizer — a private, two-way thread scoped to
// (session, member). Shares its messaging engine with DP-011 Session
// Chat (see ConversationThread); what's specific here is who the
// participants are (one member + the Club's owner/admins) and that,
// unlike Chat, there is no posting-window restriction — a thread never
// closes.
const POLL_INTERVAL_MS = 5000;

function threadName(t: SessionContactThread) {
  return t.memberDisplayName || t.memberUsername;
}

export function SessionContactOrganizer({ visible, onClose, sessionId, session, isOwnerOrAdmin, myUserId, initialMemberUserId }: Props) {
  const { t } = useTranslation();
  // null = showing the organizer's thread list (owner/admin only); a
  // plain member never sees the list, only their own thread.
  const [openMemberUserId, setOpenMemberUserId] = useState<string | null>(
    isOwnerOrAdmin ? (initialMemberUserId ?? null) : myUserId
  );
  const [threads, setThreads] = useState<SessionContactThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setOpenMemberUserId(isOwnerOrAdmin ? (initialMemberUserId ?? null) : myUserId);
  }, [visible, isOwnerOrAdmin, initialMemberUserId, myUserId]);

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await listSessionContactThreads(sessionId));
    } catch {
      // keep the stale list; pull-to-refresh retries
    } finally {
      setThreadsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!visible || !isOwnerOrAdmin || openMemberUserId !== null) return;
    loadThreads();
    const interval = setInterval(loadThreads, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [visible, isOwnerOrAdmin, openMemberUserId, loadThreads]);

  const loadMessages = useCallback(async () => {
    if (!openMemberUserId) return;
    try {
      setMessages(await listContactMessages(sessionId, openMemberUserId));
    } catch {
      // keep the stale list; the next poll or pull-to-refresh retries
    } finally {
      setMessagesLoading(false);
    }
  }, [sessionId, openMemberUserId]);

  useEffect(() => {
    if (!visible || !openMemberUserId) return;
    setMessagesLoading(true);
    loadMessages();
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [visible, openMemberUserId, loadMessages]);

  async function handleSend(body: string, image?: { base64: string; contentType: string }) {
    if (!openMemberUserId) return;
    const message = await sendContactMessage(sessionId, openMemberUserId, { body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  const showingList = isOwnerOrAdmin && openMemberUserId === null;
  const openThread = threads.find((th) => th.memberUserId === openMemberUserId);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <VStack className="flex-1 bg-slate-50 dark:bg-slate-900">
        <HStack className="px-5 pt-4 pb-3 items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <Pressable
            className="p-2 -ml-2 active:opacity-60"
            onPress={() => (isOwnerOrAdmin && openMemberUserId !== null ? setOpenMemberUserId(null) : onClose())}
          >
            <Icon name={isOwnerOrAdmin && openMemberUserId !== null ? 'arrow-back' : 'close'} size="lg" />
          </Pressable>
          <Text className="text-lg font-black text-slate-900 dark:text-white">
            {showingList ? t('sessionContactTitle') : isOwnerOrAdmin && openThread ? threadName(openThread) : t('sessionContactTitle')}
          </Text>
          <Box className="w-9" />
        </HStack>

        {showingList ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 py-4 gap-2"
            refreshControl={<RefreshControl refreshing={threadsLoading} onRefresh={loadThreads} />}
          >
            {threads.length === 0 && !threadsLoading ? (
              <VStack className="items-center py-16 gap-3">
                <Icon name="mail-outline" size="xl" color="muted" />
                <Text className="text-slate-500 dark:text-slate-400 text-center">{t('sessionContactThreadsEmpty')}</Text>
              </VStack>
            ) : (
              threads.map((th) => (
                <Pressable
                  key={th.memberUserId}
                  className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 active:opacity-70"
                  onPress={() => setOpenMemberUserId(th.memberUserId)}
                >
                  <Box className="w-11 h-11 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-700">
                    <Text className="text-sm font-extrabold text-slate-600 dark:text-slate-300">{initialsFromName(threadName(th))}</Text>
                  </Box>
                  <VStack className="flex-1 gap-0.5">
                    <Text className="font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                      {threadName(th)}
                    </Text>
                    <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
                      {th.lastMessageBody}
                    </Text>
                  </VStack>
                  {th.needsReply && <Box className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : (
          <ConversationThread
            sessionId={sessionId}
            messages={messages}
            loading={messagesLoading}
            onRefresh={loadMessages}
            myUserId={myUserId}
            // No posting-window restriction — a Contact Organizer thread
            // never closes, unlike Session Chat.
            canPost={true}
            closedNotice=""
            emptyText={t('sessionContactEmpty')}
            placeholder={t('sessionContactPlaceholder')}
            onSend={handleSend}
          />
        )}
      </VStack>
    </Modal>
  );
}
