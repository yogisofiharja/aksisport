import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { listMyContactThreads } from '../../core/api/client';
import type { SessionContactThread } from '../../core/api/types';

type Props = {
  onOpenSession: (sessionId: string, memberUserId: string) => void;
};

// DP-013 Contact Organizer's Inbox — the first real content this tab has
// ever had (Milestone 1 shipped it as a placeholder; no Communication
// data model existed yet). One row per thread the caller is a party to,
// either as the member or as an owner/admin replying on behalf of the
// organizer — most-recently-active first.
export function InboxScreen({ onOpenSession }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [threads, setThreads] = useState<SessionContactThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setThreads(await listMyContactThreads());
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

  function partyLabel(thread: SessionContactThread) {
    if (thread.memberUserId === profile?.id) {
      return t('inboxContactOrganizerParty', thread.clubName);
    }
    return thread.memberDisplayName || thread.memberUsername;
  }

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Typography variant="display">{t('inboxTitle')}</Typography>

      {loading && threads.length === 0 ? (
        <Loading />
      ) : threads.length === 0 ? (
        <EmptyState message={t('inboxEmptyState')} />
      ) : (
        <VStack space="md">
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
                {thread.needsReply && <View className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5" />}
              </HStack>
            </Pressable>
          ))}
        </VStack>
      )}
    </ScrollPage>
  );
}
