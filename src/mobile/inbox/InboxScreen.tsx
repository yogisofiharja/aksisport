import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader, listMyContactThreads } from '../../core/api/client';
import { listDirectThreads } from '../../core/messages/api';
import { useLiveEvents } from '../../core/live/live';
import { UnreadCount } from '../messages/UnreadCount';
import { listMyGroups } from '../../core/messages/groups';
import { groupLabel } from '../../core/messages/groupLabel';
import type { DirectThread, GroupThread, SessionContactThread } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { GroupAvatar, PersonAvatar } from '../messages/PersonAvatar';
import { inboxTime } from './inboxTime';

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
  const { t, lang } = useTranslation();
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

  function ownPrefix(senderId: string | undefined, text: string) {
    return senderId === profile?.id ? `${t('inboxYouPrefix')} ${text}` : text;
  }

  return (
    <ScrollPage
      gap="lg"
      appBar={<AppBar variant="root" title={t('inboxTitle')} actions={[{ icon: 'create-outline', label: t('newChat'), onPress: onNewChat }]} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {loading && empty ? (
        <Loading />
      ) : empty ? (
        <EmptyState message={t('inboxEmptyState')} />
      ) : (
        <>
          {/* Messages: direct conversations and groups together, most
              recently active first. */}
          {messageRows.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('inboxDirectTitle')}
              </Typography>
              <ListGroup>
                {messageRows.map(({ direct: thread, group }) => {
                  if (group) {
                    const label = groupLabel(group.title, group.memberNames, group.memberCount - 1);
                    return (
                      <ListRow
                        key={group.conversationId}
                        leading={<GroupAvatar names={group.memberNames.length > 0 ? group.memberNames : [label]} />}
                        title={label}
                        strong={group.unreadCount > 0}
                        subtitle={groupPreview(group)}
                        aside={inboxTime(group.lastActivityAt, lang, t('inboxYesterday'))}
                        trailing={<UnreadCount count={group.unreadCount} />}
                        onPress={() => onOpenGroup(group.conversationId)}
                      />
                    );
                  }
                  if (!thread) return null;
                  const name = thread.otherDisplayName || thread.otherUsername;
                  const preview = thread.lastMessageDeleted
                    ? t('chatMessageDeleted')
                    : thread.lastMessageBody || (thread.lastMessageHasImage ? t('inboxPhoto') : '');
                  return (
                    <ListRow
                      key={thread.otherUserId}
                      leading={
                        // DP-014: the success ring marks someone online.
                        <View className={`rounded-full p-0.5 border-2 ${thread.otherIsOnline ? 'border-success dark:border-success-dark' : 'border-transparent'}`}>
                          <PersonAvatar userId={thread.otherUserId} name={name} hasAvatar={thread.otherHasAvatar} headers={imageHeaders} size={36} />
                        </View>
                      }
                      title={name}
                      strong={thread.unreadCount > 0}
                      subtitle={ownPrefix(thread.lastMessageSenderId, preview)}
                      aside={inboxTime(thread.lastMessageAt, lang, t('inboxYesterday'))}
                      trailing={<UnreadCount count={thread.unreadCount} />}
                      onPress={() => onOpenDirectMessage(thread.otherUserId)}
                    />
                  );
                })}
              </ListGroup>
            </VStack>
          )}

          {/* Session conversations (DP-013 Contact Organizer). */}
          {threads.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('inboxSessionThreadsTitle')}
              </Typography>
              <ListGroup>
                {threads.map((thread) => (
                  <ListRow
                    key={`${thread.sessionId}:${thread.memberUserId}`}
                    icon="chatbubbles-outline"
                    title={partyLabel(thread)}
                    strong={thread.unreadCount > 0}
                    subtitle={[
                      thread.sessionName ?? thread.clubName,
                      ownPrefix(thread.lastMessageSenderId, thread.lastMessageDeleted ? t('chatMessageDeleted') : thread.lastMessageBody),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    aside={inboxTime(thread.lastMessageAt, lang, t('inboxYesterday'))}
                    trailing={<UnreadCount count={thread.unreadCount} />}
                    onPress={() => onOpenSession(thread.sessionId, thread.memberUserId)}
                  />
                ))}
              </ListGroup>
            </VStack>
          )}
        </>
      )}
    </ScrollPage>
  );
}
