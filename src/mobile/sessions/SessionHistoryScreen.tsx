import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { listMyJoinedSessions } from '../../core/sessions/api';
import { sessionDateBucket } from '../../core/sessions/sessionSchedule';
import type { JoinedSession, Session } from '../../core/api/types';
import { sessionCardProps } from './sessionDisplay';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
};

function byStartsAtDesc(a: Session, b: Session) {
  return (b.startsAt ?? '').localeCompare(a.startsAt ?? '');
}

// The Player's own Session History (DP-009), opened from Me: every
// Session they joined, across all their Clubs, whose date is before today,
// most recent first, each labelled with its Club. A Community's own past
// Sessions are its Sessions tab, on Past.
export function SessionHistoryScreen({ onBack, onOpenSession }: Props) {
  const { t, lang } = useTranslation();
  const [sessions, setSessions] = useState<JoinedSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSessions(await listMyJoinedSessions());
    } catch {
      // keep stale list; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pastSessions = sessions.filter((s) => sessionDateBucket(s) === 'past').sort(byStartsAtDesc);

  return (
    <ScrollPage
      gap="lg"
      appBar={<AppBar title={t('mySessionHistoryTitle')} onBack={onBack} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >

      {loading && sessions.length === 0 ? (
        <Loading />
      ) : pastSessions.length === 0 ? (
        <EmptyState message={t('mySessionHistoryEmptyState')} />
      ) : (
        <VStack space="sm">
          {pastSessions.map((session) => (
            <SessionCard
              key={session.id}
              {...sessionCardProps(
                session,
                t,
                lang,
                [session.clubName, session.location].filter(Boolean).join(' · ')
              )}
              onPress={() => onOpenSession(session.id)}
            />
          ))}
        </VStack>
      )}
    </ScrollPage>
  );
}
