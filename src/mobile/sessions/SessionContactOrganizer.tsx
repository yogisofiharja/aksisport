import { useCallback, useEffect, useState } from 'react';
import { Modal, RefreshControl, ScrollView } from 'react-native';
import { Icon } from '../../design-system/ui/Icon';
import { Box, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { listContactMessages, listSessionContactThreads, sendContactMessage, conversationMessageImageUrl } from '../../core/sessions/api';
import { initialsFromName } from '../../core/initials';
import { ConversationThread } from './ConversationThread';
import { UnreadCount } from '../messages/UnreadCount';
import { usePollInterval, useLiveEvents } from '../../core/live/live';
import type { ConversationMessage, Session, SessionContactThread } from '../../core/api/types';
import { CloseOnBack } from '../../design-system/feedback/useBackToClose';
import { AppBar } from '../../design-system/layout/AppBar';

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
  const pollInterval = usePollInterval();

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
    const interval = setInterval(loadThreads, pollInterval);
    return () => clearInterval(interval);
  }, [visible, isOwnerOrAdmin, openMemberUserId, loadThreads, pollInterval]);

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
    const interval = setInterval(loadMessages, pollInterval);
    return () => clearInterval(interval);
  }, [visible, openMemberUserId, loadMessages, pollInterval]);

  // DP-021: a new message in this Session's Contact Organizer threads
  // refreshes the organizer's list at once; an open thread refreshes
  // itself (ConversationThread), except before its first message.
  useLiveEvents((e) => {
    if (!visible || e.type !== 'message.created' || e.data?.kind !== 'session_contact' || e.data?.sessionId !== sessionId) return;
    if (openMemberUserId === null) loadThreads();
    else if (messages.length === 0) loadMessages();
  });

  async function handleSend(body: string, image?: { base64: string; contentType: string }) {
    if (!openMemberUserId) return;
    const message = await sendContactMessage(sessionId, openMemberUserId, { body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  const showingList = isOwnerOrAdmin && openMemberUserId === null;
  const openThread = threads.find((th) => th.memberUserId === openMemberUserId);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <CloseOnBack onClose={onClose} />
      <VStack className="flex-1 bg-ground dark:bg-ground-dark">
        {/* A modal over the Session: ✕ closes it; inside one thread of the
            organizer's list, back returns to the list. */}
        <AppBar
          safeTop
          variant={isOwnerOrAdmin && openMemberUserId !== null ? 'stack' : 'form'}
          title={showingList ? t('sessionContactTitle') : isOwnerOrAdmin && openThread ? threadName(openThread) : t('sessionContactTitle')}
          onBack={() => setOpenMemberUserId(null)}
          onClose={onClose}
        />

        {showingList ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 py-4 gap-2"
            refreshControl={<RefreshControl refreshing={threadsLoading} onRefresh={loadThreads} />}
          >
            {threads.length === 0 && !threadsLoading ? (
              <VStack className="items-center py-16 gap-3">
                <Icon name="mail-outline" size="xl" color="muted" />
                <Text className="text-ink-muted dark:text-ink-muted-dark text-center">{t('sessionContactThreadsEmpty')}</Text>
              </VStack>
            ) : (
              threads.map((th) => (
                <Pressable
                  key={th.memberUserId}
                  className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-surface dark:bg-surface-dark active:opacity-70"
                  onPress={() => setOpenMemberUserId(th.memberUserId)}
                >
                  <Box className="w-11 h-11 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark">
                    <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark">{initialsFromName(threadName(th))}</Text>
                  </Box>
                  <VStack className="flex-1 gap-0.5">
                    <Text className="font-bold text-ink dark:text-ink-dark" numberOfLines={1}>
                      {threadName(th)}
                    </Text>
                    <Text className="text-sm text-ink-muted dark:text-ink-muted-dark" numberOfLines={1}>
                      {th.lastMessageDeleted ? t('chatMessageDeleted') : th.lastMessageBody}
                    </Text>
                  </VStack>
                  <UnreadCount count={th.unreadCount} />
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : (
          <ConversationThread
            imageUrl={(messageId) => conversationMessageImageUrl(sessionId, messageId)}
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
