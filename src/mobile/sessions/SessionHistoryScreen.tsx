import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { listMyJoinedSessions, listSessions } from '../../core/sessions/api';
import { sessionDateBucket } from '../../core/sessions/sessionSchedule';
import type { JoinedSession, Session } from '../../core/api/types';
import { sessionCardProps } from './sessionDisplay';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  // Omitted for the Player's own cross-Club history (opened from Me).
  clubId?: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
};

function byStartsAtDesc(a: Session, b: Session) {
  return (b.startsAt ?? '').localeCompare(a.startsAt ?? '');
}

// Session History (DP-009): every Session (any status) whose date is
// before today, most recent first. History is contextual to where the
// Player is looking — with a clubId, that Club's own past Sessions;
// without one, every Session the Player has joined across all their
// Clubs, each labelled with its Club.
export function SessionHistoryScreen({ clubId, onBack, onOpenSession }: Props) {
  const { t, lang } = useTranslation();
  const [sessions, setSessions] = useState<(Session | JoinedSession)[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSessions(clubId ? await listSessions(clubId) : await listMyJoinedSessions());
    } catch {
      // keep stale list; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pastSessions = sessions.filter((s) => sessionDateBucket(s) === 'past').sort(byStartsAtDesc);

  return (
    <ScrollPage
      gap="lg"
      appBar={<AppBar title={t(clubId ? 'sessionHistoryTitle' : 'mySessionHistoryTitle')} onBack={onBack} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >

      {loading && sessions.length === 0 ? (
        <Loading />
      ) : pastSessions.length === 0 ? (
        <EmptyState message={t(clubId ? 'sessionHistoryEmptyState' : 'mySessionHistoryEmptyState')} />
      ) : (
        <VStack space="sm">
          {pastSessions.map((session) => (
            <SessionCard
              key={session.id}
              {...sessionCardProps(
                session,
                t,
                lang,
                'clubName' in session ? [session.clubName, session.location].filter(Boolean).join(' · ') : session.location
              )}
              onPress={() => onOpenSession(session.id)}
            />
          ))}
        </VStack>
      )}
    </ScrollPage>
  );
}
