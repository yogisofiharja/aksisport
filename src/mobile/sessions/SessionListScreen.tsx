import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { listSessions } from '../../core/sessions/api';
import type { Session } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: () => void;
};

function statusLabel(status: Session['status'], t: (key: string) => string) {
  // DP-001: draft/cancelled added — without these two cases, both would
  // have silently fallen through to "Open" once the server started
  // returning them (every new session now starts as draft).
  if (status === 'draft') return t('sessionStatusDraft');
  if (status === 'cancelled') return t('sessionStatusCancelled');
  if (status === 'in_progress') return t('sessionStatusInProgress');
  if (status === 'completed') return t('sessionStatusCompleted');
  return t('sessionStatusOpen');
}

export function SessionListScreen({ clubId, onBack, onOpenSession, onCreateSession }: Props) {
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

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <Typography variant="display">{t('sessionListTitle')}</Typography>

      {loading && sessions.length === 0 ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <EmptyState message={t('sessionEmptyState')} />
      ) : (
        <VStack space="md">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              title={session.name || session.sport}
              subtitle={session.location}
              status={statusLabel(session.status, t)}
              onPress={() => onOpenSession(session.id)}
            />
          ))}
        </VStack>
      )}

      <Button action="secondary" size="xl" className="w-full" onPress={onCreateSession}>
        <ButtonText className="text-lg">{t('sessionCreate')}</ButtonText>
      </Button>
    </ScrollPage>
  );
}
