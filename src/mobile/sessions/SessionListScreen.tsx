import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Card } from '../../design-system/ui/Card';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { listSessions } from '../../core/sessions/api';
import { listMembers } from '../../core/clubs/api';
import { sessionDateBucket } from '../../core/sessions/sessionSchedule';
import { sessionCardProps } from './sessionDisplay';
import type { Session } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onOpenHistory: () => void;
};

function byStartsAtAsc(a: Session, b: Session) {
  return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
}

export function SessionListScreen({ clubId, onBack, onOpenSession, onCreateSession, onOpenHistory }: Props) {
  const { t, lang } = useTranslation();
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
  // per DP-009's Session History. Drafts appear in both buckets above
  // (bucketed by their own startsAt, same as any other Session) *and*
  // get their own callout below (UX-005 Draft Recovery) — the callout is
  // the proactive nudge at the actual "create new" decision point, not a
  // replacement for the passive list entry.
  const todaySessions = sessions.filter((s) => sessionDateBucket(s) === 'today').sort(byStartsAtAsc);
  const upcomingSessions = sessions.filter((s) => sessionDateBucket(s) === 'upcoming').sort(byStartsAtAsc);
  // Most-recently-created first — if more than one Draft exists (rare),
  // the callout only ever offers the newest; the others are still
  // reachable via the list above, just without the extra nudge.
  const [mostRecentDraft] = sessions.filter((s) => s.status === 'draft').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function renderCard(session: Session) {
    return (
      <SessionCard key={session.id} {...sessionCardProps(session, t, lang)} onPress={() => onOpenSession(session.id)} />
    );
  }

  return (
    <ScrollPage
      gap="lg"
      appBar={<AppBar title={t('sessionListTitle')} onBack={onBack} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >

      {loading && sessions.length === 0 ? (
        <Loading />
      ) : todaySessions.length === 0 && upcomingSessions.length === 0 ? (
        <EmptyState message={t(isOwnerOrAdmin ? 'sessionEmptyState' : 'sessionEmptyStateMember')} />
      ) : (
        <>
          {todaySessions.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('sessionSectionToday')}
              </Typography>
              <VStack space="sm">{todaySessions.map(renderCard)}</VStack>
            </VStack>
          )}
          {upcomingSessions.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('sessionSectionUpcoming')}
              </Typography>
              <VStack space="sm">{upcomingSessions.map(renderCard)}</VStack>
            </VStack>
          )}
        </>
      )}

      <Pressable className="items-center py-2 active:opacity-60" onPress={onOpenHistory}>
        <Typography variant="label" color="brand">
          {t('sessionPastSessions')}
        </Typography>
      </Pressable>

      {isOwnerOrAdmin && mostRecentDraft && (
        <Card bordered padding="md" className="bg-heat-tint dark:bg-heat-tint-dark border-heat-tint dark:border-heat-tint-dark">
          <HStack className="gap-3 items-start">
            <Icon name="document-text-outline" size="md" color="secondary" />
            <VStack space="xs" style={{ flex: 1 }}>
              <Typography variant="label">{t('sessionDraftRecoveryTitle')}</Typography>
              <Typography variant="body" color="muted" className="text-sm">
                {t('sessionDraftRecoveryDesc', mostRecentDraft.name || mostRecentDraft.sport)}
              </Typography>
              <Button
                variant="outline"
                size="sm"
                className="self-start mt-1"
                onPress={() => onOpenSession(mostRecentDraft.id)}
              >
                <ButtonText variant="outline">
                  {t('sessionDraftRecoveryContinue')}
                </ButtonText>
              </Button>
            </VStack>
          </HStack>
        </Card>
      )}

      {isOwnerOrAdmin && (
        <VStack space="xs">
          <Button size="xl" className="w-full" onPress={onCreateSession}>
            <ButtonText>{t('sessionCreate')}</ButtonText>
          </Button>
          {mostRecentDraft && (
            <Typography variant="body" color="muted" className="text-xs text-center">
              {t('sessionDraftRecoveryStartNew')}
            </Typography>
          )}
        </VStack>
      )}
    </ScrollPage>
  );
}
