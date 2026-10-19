import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader, listMyContactThreads, userAvatarUrl } from '../../core/api/client';
import { listDirectThreads } from '../../core/messages/api';
import { initialsFromName } from '../../core/initials';
import { useLiveEvents } from '../../core/live/live';
import { UnreadCount } from '../messages/UnreadCount';
import { listMyGroups } from '../../core/messages/groups';
import { groupLabel } from '../../core/messages/groupLabel';
import { Icon } from '../../design-system/ui/Icon';
import type { DirectThread, GroupThread, SessionContactThread } from '../../core/api/types';

type Props = {
  onOpenSession: (sessionId: string, memberUserId: string) => void;
  onOpenDirectMessage: (userId: string) => void;
  onOpenGroup: (groupId: string) => void;
  onNewChat: () => void;
};

// DP-013 Contact Organizer's Inbox — the first real content this tab has
// ever had (Milestone 1 shipped it as a placeholder; no Communication
// data model existed yet). One row per thread the caller is a party to,
// either as the member or as an owner/admin replying on behalf of the
// organizer — most-recently-active first.
export function InboxScreen({ onOpenSession, onOpenDirectMessage, onOpenGroup, onNewChat }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [threads, setThreads] = useState<SessionContactThread[]>([]);
  // DP-020: one-to-one conversations, listed above the Session threads.
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  // DP-021: group chats, listed with the direct conversations.
  const [groups, setGroups] = useState<GroupThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const [contact, direct, groupList] = await Promise.all([
        listMyContactThreads(),
        listDirectThreads().catch(() => []),
        listMyGroups().catch(() => []),
      ]);
      setThreads(contact);
      setDirectThreads(direct);
      setGroups(groupList);
    } catch {
      // stays stale; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // DP-021: a new message or a read anywhere in Inbox's conversations
  // re-fetches the list (latest message, unread counts), briefly batched.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((e) => {
    const listed = e.data?.kind !== 'session_chat' && e.data?.kind !== 'club';
    const relevant =
      (e.type === 'message.created' && listed) || e.type === 'group.updated' || (e.type === 'read' && e.data?.userId === profile?.id);
    if (!relevant) return;
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 300);
  });
  useEffect(() => () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
  }, []);

  function partyLabel(thread: SessionContactThread) {
    if (thread.memberUserId === profile?.id) {
      return t('inboxContactOrganizerParty', thread.clubName);
    }
    return thread.memberDisplayName || thread.memberUsername;
  }

  // Direct conversations and groups together, most recently active first.
  const messageRows: Array<{ at: string; direct?: DirectThread; group?: GroupThread }> = [
    ...directThreads.map((d) => ({ at: d.lastMessageAt, direct: d })),
    ...groups.map((g) => ({ at: g.lastActivityAt, group: g })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const empty = threads.length === 0 && messageRows.length === 0;

  function groupPreview(g: GroupThread) {
    if (!g.lastMessageSenderId) return t('groupMemberCount', g.memberCount);
    const text = g.lastMessageDeleted ? t('chatMessageDeleted') : g.lastMessageBody || (g.lastMessageHasImage ? t('inboxPhoto') : '');
    const who = g.lastMessageSenderId === profile?.id ? t('inboxYouPrefix') : `${g.lastMessageSenderDisplayName || g.lastMessageSenderUsername}:`;
    return `${who} ${text}`;
  }

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <HStack className="justify-between items-center">
        <Typography variant="heading">{t('inboxTitle')}</Typography>
        <Pressable onPress={onNewChat} hitSlop={8} className="p-2 -mr-2 active:opacity-60" accessibilityLabel={t('newChat')}>
          <Icon name="create-outline" size="lg" color="secondary" />
        </Pressable>
      </HStack>

      {loading && empty ? (
        <Loading />
      ) : empty ? (
        <EmptyState message={t('inboxEmptyState')} />
      ) : (
        <VStack space="md">
          {messageRows.length > 0 && (
            <Typography variant="overline" color="muted">
              {t('inboxDirectTitle')}
            </Typography>
          )}
          {messageRows.map(({ direct: thread, group }) => {
            if (group) {
              return (
                <Pressable
                  key={group.conversationId}
                  className="bg-surface dark:bg-surface-dark rounded-2xl p-4 active:opacity-70"
                  onPress={() => onOpenGroup(group.conversationId)}
                >
                  <HStack className="items-center" space="md">
                    <View className="w-10 h-10 rounded-full items-center justify-center bg-heat-tint dark:bg-heat-tint-dark">
                      <Icon name="people" size="sm" color="secondary" />
                    </View>
                    <VStack space="xs" style={{ flex: 1 }}>
                      <Typography variant="body" className="text-base font-bold" numberOfLines={1}>
                        {groupLabel(group.title, group.memberNames, group.memberCount - 1)}
                      </Typography>
                      <Typography variant="body" color="muted" className="text-sm" numberOfLines={1}>
                        {groupPreview(group)}
                      </Typography>
                    </VStack>
                    <UnreadCount count={group.unreadCount} />
                  </HStack>
                </Pressable>
              );
            }
            if (!thread) return null;
            const name = thread.otherDisplayName || thread.otherUsername;
            const preview = thread.lastMessageDeleted
              ? t('chatMessageDeleted')
              : thread.lastMessageBody || (thread.lastMessageHasImage ? t('inboxPhoto') : '');
            return (
              <Pressable
                key={thread.otherUserId}
                className="bg-surface dark:bg-surface-dark rounded-2xl p-4 active:opacity-70"
                onPress={() => onOpenDirectMessage(thread.otherUserId)}
              >
                <HStack className="items-center" space="md">
                  <View className={`rounded-full ${thread.otherIsOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
                    <View className="w-10 h-10 rounded-full items-center justify-center overflow-hidden bg-surface-sunken dark:bg-surface-sunken-dark">
                      {thread.otherHasAvatar ? (
                        <Image source={{ uri: userAvatarUrl(thread.otherUserId), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Typography variant="body" className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark">
                          {initialsFromName(name)}
                        </Typography>
                      )}
                    </View>
                  </View>
                  <VStack space="xs" style={{ flex: 1 }}>
                    <Typography variant="body" className="text-base font-bold" numberOfLines={1}>
                      {name}
                    </Typography>
                    <Typography variant="body" color="muted" className="text-sm" numberOfLines={1}>
                      {thread.lastMessageSenderId === profile?.id ? `${t('inboxYouPrefix')} ${preview}` : preview}
                    </Typography>
                  </VStack>
                  <UnreadCount count={thread.unreadCount} />
                </HStack>
              </Pressable>
            );
          })}
          {messageRows.length > 0 && threads.length > 0 && (
            <Typography variant="overline" color="muted">
              {t('inboxSessionThreadsTitle')}
            </Typography>
          )}
          {threads.map((thread) => (
            <Pressable
              key={`${thread.sessionId}:${thread.memberUserId}`}
              className="bg-surface dark:bg-surface-dark rounded-2xl p-4 active:opacity-70"
              onPress={() => onOpenSession(thread.sessionId, thread.memberUserId)}
            >
              <HStack className="justify-between items-start" space="md">
                <VStack space="xs" style={{ flex: 1 }}>
                  <Typography variant="body" className="text-base font-bold" numberOfLines={1}>
                    {thread.sessionName ?? thread.clubName}
                  </Typography>
                  <Typography variant="body" color="muted" className="text-sm" numberOfLines={1}>
                    {partyLabel(thread)}
                  </Typography>
                  <Typography variant="body" color="muted" className="text-sm" numberOfLines={1}>
                    {thread.lastMessageDeleted ? t('chatMessageDeleted') : thread.lastMessageBody}
                  </Typography>
                </VStack>
                <UnreadCount count={thread.unreadCount} />
              </HStack>
            </Pressable>
          ))}
        </VStack>
      )}
    </ScrollPage>
  );
}
