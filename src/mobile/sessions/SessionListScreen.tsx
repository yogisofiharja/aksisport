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
import type { BadgeAction } from '../../design-system/ui/Badge';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { listSessions } from '../../core/sessions/api';
import { listMembers } from '../../core/clubs/api';
import { formatSessionDateTime, sessionDateBucket } from '../../core/sessions/sessionSchedule';
import type { Session } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onOpenHistory: () => void;
};

// Milestone 2: branches on the server-resolved lifecycleStatus, not raw
// status — 'open' no longer collapses into a single "Open" label,
// Recruiting/Ready/Full (DP-001's derived sub-states) get their own copy.
export function statusLabel(status: Session['lifecycleStatus'], t: (key: string) => string) {
  if (status === 'draft') return t('sessionStatusDraft');
  if (status === 'cancelled') return t('sessionStatusCancelled');
  if (status === 'in_progress') return t('sessionStatusInProgress');
  if (status === 'completed') return t('sessionStatusCompleted');
  if (status === 'recruiting') return t('sessionStatusRecruiting');
  if (status === 'ready') return t('sessionStatusReady');
  return t('sessionStatusFull');
}

// Distinct colors per lifecycle status so the list is scannable without
// reading every pill's text.
export function sessionStatusColor(status: Session['lifecycleStatus']): BadgeAction {
  if (status === 'draft') return 'warning';
  if (status === 'cancelled') return 'error';
  if (status === 'in_progress') return 'success';
  if (status === 'completed') return 'muted';
  if (status === 'recruiting') return 'info';
  if (status === 'ready') return 'success';
  return 'warning'; // full
}

function byStartsAtAsc(a: Session, b: Session) {
  return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
}

export function SessionListScreen({ clubId, onBack, onOpenSession, onCreateSession, onOpenHistory }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  // Create Session is owner/admin only (server already enforces this,
  // same as Recurring Schedules) — the button used to show to every
  // member regardless of role, only failing once they'd filled out the
  // whole form and hit Submit. Gated here instead so it's never offered
  // to begin with.
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sess, members] = await Promise.all([listSessions(clubId), listMembers(clubId)]);
      setSessions(sess);
      setIsOwnerOrAdmin(members.some((m) => m.userId === profile?.id && (m.role === 'owner' || m.role === 'admin')));
    } catch {
      // keep stale list; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, [clubId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Main list is Today + Upcoming only — a cancelled Session still on
  // today's date stays visible (bucketed by date, not status). Past
  // Sessions (any status, earlier date) move to their own entry point,
  // per DP-009's Session History.
  const todaySessions = sessions.filter((s) => sessionDateBucket(s) === 'today').sort(byStartsAtAsc);
  const upcomingSessions = sessions.filter((s) => sessionDateBucket(s) === 'upcoming').sort(byStartsAtAsc);

  function renderCard(session: Session) {
    return (
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
    );
  }

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <Typography variant="display">{t('sessionListTitle')}</Typography>

      {loading && sessions.length === 0 ? (
        <Loading />
      ) : todaySessions.length === 0 && upcomingSessions.length === 0 ? (
        <EmptyState message={t(isOwnerOrAdmin ? 'sessionEmptyState' : 'sessionEmptyStateMember')} />
      ) : (
        <>
          {todaySessions.length > 0 && (
            <VStack space="sm">
              <Typography variant="caption" color="muted">
                {t('sessionSectionToday')}
              </Typography>
              <VStack space="md">{todaySessions.map(renderCard)}</VStack>
            </VStack>
          )}
          {upcomingSessions.length > 0 && (
            <VStack space="sm">
              <Typography variant="caption" color="muted">
                {t('sessionSectionUpcoming')}
              </Typography>
              <VStack space="md">{upcomingSessions.map(renderCard)}</VStack>
            </VStack>
          )}
        </>
      )}

      <Pressable className="items-center py-2 active:opacity-60" onPress={onOpenHistory}>
        <Typography variant="label" color="brand">
          {t('sessionPastSessions')}
        </Typography>
      </Pressable>

      {isOwnerOrAdmin && (
        <Button action="secondary" size="xl" className="w-full" onPress={onCreateSession}>
          <ButtonText className="text-lg">{t('sessionCreate')}</ButtonText>
        </Button>
      )}
    </ScrollPage>
  );
}
