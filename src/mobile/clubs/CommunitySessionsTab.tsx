import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Edge } from 'react-native-safe-area-context';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { AppBar } from '../../design-system/layout/AppBar';
import { Typography } from '../../design-system/ui/Typography';
import { Segmented } from '../../design-system/ui/Segmented';
import { ListRow } from '../../design-system/ui/List';
import { Fab } from '../../design-system/ui/Fab';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Alert } from '../../design-system/feedback/Alert';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { listSessions } from '../../core/sessions/api';
import { getClub, listMembers } from '../../core/clubs/api';
import { listRecurringSchedules } from '../../core/recurringSchedules/api';
import { draftSessions, pastSessions, upcomingGroups } from '../../core/sessions/sessionGroups';
import { sessionCardProps } from '../sessions/sessionDisplay';
import { scheduleShort } from '../recurringSchedules/weekday';
import type { RecurringSchedule, Session } from '../../core/api/types';
import type { SessionsView } from './CommunityScreen';

type Props = {
  clubId: string;
  edges?: Edge[];
  initialView?: SessionsView;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onOpenRecurringSchedules: () => void;
};

// A Community's Sessions tab (Aksi redesign › Community · Sessions):
// Upcoming (Today, This week, Later), Past (DP-009's Session History for
// this Community) and, for owners/admins, Drafts with their count. Owners
// and admins also get the Community's Recurring Schedules as one row at
// the top, and New session as the floating button — creating a Session is
// owner/admin only, and the server enforces it too.
export function CommunitySessionsTab({ clubId, edges, initialView, onBack, onOpenSession, onCreateSession, onOpenRecurringSchedules }: Props) {
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const [view, setView] = useState<SessionsView>(initialView ?? 'upcoming');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sess, members, club] = await Promise.all([listSessions(clubId), listMembers(clubId), getClub(clubId)]);
      setSessions(sess);
      setClubName(club.name);
      const organizer = members.some((m) => m.userId === profile?.id && (m.role === 'owner' || m.role === 'admin'));
      setIsOwnerOrAdmin(organizer);
      setSchedules(organizer ? await listRecurringSchedules(clubId).catch(() => []) : []);
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

  const upcoming = upcomingGroups(sessions);
  const past = pastSessions(sessions);
  const drafts = draftSessions(sessions);
  // UX-005 Draft Recovery: on Upcoming, the newest draft is offered before
  // starting another one.
  const [newestDraft] = [...drafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shownView: SessionsView = view === 'drafts' && !isOwnerOrAdmin ? 'upcoming' : view;

  function renderCards(list: Session[]) {
    return (
      <VStack space="sm">
        {list.map((session) => (
          <SessionCard key={session.id} {...sessionCardProps(session, t, lang)} onPress={() => onOpenSession(session.id)} />
        ))}
      </VStack>
    );
  }

  function renderGroup(title: string, list: Session[]) {
    if (list.length === 0) return null;
    return (
      <VStack space="sm">
        <Typography variant="overline" color="muted">
          {title}
        </Typography>
        {renderCards(list)}
      </VStack>
    );
  }

  const activeSchedules = schedules.filter((s) => s.status !== 'paused');

  return (
    <View className="flex-1">
      <ScrollPage
        gap="lg"
        edges={edges}
        // Room for the floating New session button over the last card.
        contentContainerStyle={isOwnerOrAdmin ? { paddingBottom: 96 } : undefined}
        appBar={<AppBar context={clubName} largeTitle={t('sessionListTitle')} onBack={onBack} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Segmented<SessionsView>
          options={[
            { value: 'upcoming', label: t('sessionsUpcoming') },
            { value: 'past', label: t('sessionsPast') },
            ...(isOwnerOrAdmin ? [{ value: 'drafts' as const, label: t('sessionsDrafts'), count: drafts.length }] : []),
          ]}
          value={shownView}
          onChange={setView}
        />

        {isOwnerOrAdmin && shownView === 'upcoming' && (
          <ListRow
            framed="light"
            icon="repeat"
            title={schedules.length > 0 ? t('sessionsSchedulesCount', schedules.length) : t('sessionsSchedulesNone')}
            subtitle={
              schedules.length > 0
                ? (activeSchedules.length > 0 ? activeSchedules : schedules).map((s) => scheduleShort(s.recurrenceRule, t)).join(' · ')
                : t('sessionsSchedulesNoneHint')
            }
            chevron
            onPress={onOpenRecurringSchedules}
          />
        )}

        {isOwnerOrAdmin && shownView === 'upcoming' && newestDraft && (
          <Alert
            tone="heat"
            icon="document-text-outline"
            title={t('sessionDraftRecoveryTitle')}
            actionLabel={t('sessionDraftRecoveryContinue')}
            onAction={() => onOpenSession(newestDraft.id)}
          >
            {t('sessionDraftRecoveryDesc', newestDraft.name || newestDraft.sport)}
          </Alert>
        )}

        {loading && sessions.length === 0 ? (
          <Loading />
        ) : shownView === 'upcoming' ? (
          upcoming.today.length + upcoming.thisWeek.length + upcoming.later.length === 0 ? (
            <EmptyState
              illustration="no-sessions"
              title={t('sessionsUpcomingEmptyTitle')}
              message={t(isOwnerOrAdmin ? 'sessionsEmptyOrganizer' : 'sessionsEmptyMember')}
            />
          ) : (
            <>
              {renderGroup(t('sessionSectionToday'), upcoming.today)}
              {renderGroup(t('sessionsThisWeek'), upcoming.thisWeek)}
              {renderGroup(t('sessionsLater'), upcoming.later)}
            </>
          )
        ) : shownView === 'past' ? (
          past.length === 0 ? <EmptyState message={t('sessionHistoryEmptyState')} /> : renderCards(past)
        ) : drafts.length === 0 ? (
          <EmptyState message={t('sessionsDraftsEmpty')} />
        ) : (
          renderCards(drafts)
        )}
      </ScrollPage>
      {isOwnerOrAdmin && <Fab label={t('sessionsNew')} onPress={onCreateSession} />}
    </View>
  );
}
