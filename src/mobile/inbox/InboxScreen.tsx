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
import type { DirectThread, SessionContactThread } from '../../core/api/types';

type Props = {
  onOpenSession: (sessionId: string, memberUserId: string) => void;
  onOpenDirectMessage: (userId: string) => void;
};

// DP-013 Contact Organizer's Inbox — the first real content this tab has
// ever had (Milestone 1 shipped it as a placeholder; no Communication
// data model existed yet). One row per thread the caller is a party to,
// either as the member or as an owner/admin replying on behalf of the
// organizer — most-recently-active first.
export function InboxScreen({ onOpenSession, onOpenDirectMessage }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [threads, setThreads] = useState<SessionContactThread[]>([]);
  // DP-020: one-to-one conversations, listed above the Session threads.
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const [contact, direct] = await Promise.all([listMyContactThreads(), listDirectThreads().catch(() => [])]);
      setThreads(contact);
      setDirectThreads(direct);
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
    const listed = e.data?.kind !== 'session_chat';
    if (!((e.type === 'message.created' && listed) || (e.type === 'read' && e.data?.userId === profile?.id))) return;
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

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Typography variant="display">{t('inboxTitle')}</Typography>

      {loading && threads.length === 0 && directThreads.length === 0 ? (
        <Loading />
      ) : threads.length === 0 && directThreads.length === 0 ? (
        <EmptyState message={t('inboxEmptyState')} />
      ) : (
        <VStack space="md">
          {directThreads.length > 0 && (
            <Typography variant="caption" color="muted">
              {t('inboxDirectTitle')}
            </Typography>
          )}
          {directThreads.map((thread) => {
            const name = thread.otherDisplayName || thread.otherUsername;
            const preview = thread.lastMessageBody || (thread.lastMessageHasImage ? t('inboxPhoto') : '');
            return (
              <Pressable
                key={thread.otherUserId}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 active:opacity-70"
                onPress={() => onOpenDirectMessage(thread.otherUserId)}
              >
                <HStack className="items-center" space="md">
                  <View className={`rounded-full ${thread.otherIsOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
                    <View className="w-10 h-10 rounded-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700">
                      {thread.otherHasAvatar ? (
                        <Image source={{ uri: userAvatarUrl(thread.otherUserId), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Typography variant="body" className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
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
          {directThreads.length > 0 && threads.length > 0 && (
            <Typography variant="caption" color="muted">
              {t('inboxSessionThreadsTitle')}
            </Typography>
          )}
          {threads.map((thread) => (
            <Pressable
              key={`${thread.sessionId}:${thread.memberUserId}`}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 active:opacity-70"
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
                    {thread.lastMessageBody}
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
