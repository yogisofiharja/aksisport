import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { listSessions } from '../../core/sessions/api';
import { formatSessionDateTime, sessionDateBucket } from '../../core/sessions/sessionSchedule';
import type { Session } from '../../core/api/types';
import { statusLabel, sessionStatusColor } from './SessionListScreen';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
};

function byStartsAtDesc(a: Session, b: Session) {
  return (b.startsAt ?? '').localeCompare(a.startsAt ?? '');
}

// Club-scoped Session History (DP-009): every Session (any status) whose
// date is before today, most recent first. The cross-Club "every Session
// I've joined" view described alongside DP-009 is a separate, not-yet-
// built entry point — this one only covers "inside a Club."
export function SessionHistoryScreen({ clubId, onBack, onOpenSession }: Props) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions(clubId));
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
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <Typography variant="display">{t('sessionHistoryTitle')}</Typography>

      {loading && sessions.length === 0 ? (
        <Loading />
      ) : pastSessions.length === 0 ? (
        <EmptyState message={t('sessionHistoryEmptyState')} />
      ) : (
        <VStack space="md">
          {pastSessions.map((session) => (
            <SessionCard
              key={session.id}
              title={session.name || session.sport}
              subtitle={session.location}
              dateTime={formatSessionDateTime(session.startsAt)}
              status={statusLabel(session.lifecycleStatus, t)}
              statusAction={sessionStatusColor(session.lifecycleStatus)}
              joinedCount={session.joinedCount}
              maxParticipants={session.maxParticipants}
              onPress={() => onOpenSession(session.id)}
            />
          ))}
        </VStack>
      )}
    </ScrollPage>
  );
}
