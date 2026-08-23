import { useCallback, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Page } from '../../design-system/layout/Page';
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
import { deleteClub, getClub, listMembers, regenerateInviteCode } from '../../core/clubs/api';
import { listSessions } from '../../core/sessions/api';
import { sessionDateBucket, formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import { statusLabel, sessionStatusColor } from '../sessions/SessionListScreen';
import type { Club, Session } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenMembers: (clubId: string) => void;
  onOpenSessions: (clubId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenRecurringSchedules: (clubId: string) => void;
  onDeleted: () => void;
};

function isLiveSession(s: Session) {
  return s.status === 'in_progress';
}

function isDraftSession(s: Session) {
  return s.status === 'draft';
}

function byStartsAtAsc(a: Session, b: Session) {
  return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
}

// Milestone 3 — Community Home: replaces the club's static info layout
// with a ranked "Current Focus" list — Live, Today, Next (the single
// soonest upcoming Session, not every upcoming one), Draft — using the
// same lifecycle language/derived status Milestone 2 established
// (statusLabel/sessionStatusColor, already shared with HomeScreen's own
// cross-club attention list). Draft Sessions are only ever present here
// for an owner/admin caller — listSessions already excludes them
// server-side for a plain member (DP-001), so no extra client-side
// gating is needed to keep a member from seeing someone else's draft.
function currentFocusSessions(sessions: Session[]): Session[] {
  const live = sessions.filter(isLiveSession);
  const today = sessions
    .filter((s) => !isLiveSession(s) && !isDraftSession(s) && sessionDateBucket(s) === 'today')
    .sort(byStartsAtAsc);
  const next = sessions
    .filter((s) => !isLiveSession(s) && !isDraftSession(s) && sessionDateBucket(s) === 'upcoming')
    .sort(byStartsAtAsc)
    .slice(0, 1);
  const drafts = sessions.filter(isDraftSession).sort(byStartsAtAsc);
  return [...live, ...today, ...next, ...drafts];
}

export function ClubDetailScreen({
  clubId,
  onBack,
  onOpenMembers,
  onOpenSessions,
  onOpenSession,
  onOpenRecurringSchedules,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clubResult, members, sessionsResult] = await Promise.all([
        getClub(clubId),
        listMembers(clubId),
        listSessions(clubId),
      ]);
      setClub(clubResult);
      setSessions(sessionsResult);
      setIsOwner(members.some((m) => m.userId === profile?.id && m.role === 'owner'));
      // Recurring Schedules is an organizer-only management surface
      // (DP-007) — owner or admin, same as who can create Sessions.
      setIsOwnerOrAdmin(members.some((m) => m.userId === profile?.id && (m.role === 'owner' || m.role === 'admin')));
    } catch {
      // leave stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [clubId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await regenerateInviteCode(clubId);
      setClub(updated);
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(t('clubDeleteConfirmTitle'), t('clubDeleteConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteClub(clubId);
            onDeleted();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading || !club) {
    return (
      <Page>
        <Loading fullScreen />
      </Page>
    );
  }

  const focus = currentFocusSessions(sessions);

  return (
    <ScrollPage>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <VStack space="xs">
        <Typography variant="display">{club.name}</Typography>
        {club.description && (
          <Typography variant="body" color="muted">
            {club.description}
          </Typography>
        )}
      </VStack>

      <VStack space="sm">
        <Typography variant="caption" color="muted">
          {t('clubCurrentFocusTitle')}
        </Typography>
        {focus.length === 0 ? (
          <EmptyState message={isOwnerOrAdmin ? t('clubCurrentFocusEmptyOrganizer') : t('clubCurrentFocusEmpty')} />
        ) : (
          <VStack space="md">
            {focus.map((session) => (
              <SessionCard
                key={session.id}
                title={session.name ?? club.name}
                dateTime={formatSessionDateTime(session.startsAt)}
                status={statusLabel(session.lifecycleStatus, t)}
                statusAction={sessionStatusColor(session.lifecycleStatus)}
                joinedCount={session.status === 'draft' ? undefined : session.joinedCount}
                maxParticipants={session.maxParticipants}
                onPress={() => onOpenSession(session.id)}
              />
            ))}
          </VStack>
        )}
      </VStack>

      <Button action="secondary" size="xl" className="w-full" onPress={() => onOpenSessions(clubId)}>
        <ButtonText className="text-lg">{t('sessionListTitle')}</ButtonText>
      </Button>

      <Button action="secondary" variant="outline" size="xl" className="w-full" onPress={() => onOpenMembers(clubId)}>
        <ButtonText action="secondary" variant="outline" className="text-lg">
          {t('clubMembersTitle')}
        </ButtonText>
      </Button>

      {isOwnerOrAdmin && (
        <Button action="secondary" variant="outline" size="xl" className="w-full" onPress={() => onOpenRecurringSchedules(clubId)}>
          <ButtonText action="secondary" variant="outline" className="text-lg">
            {t('recurringScheduleListTitle')}
          </ButtonText>
        </Button>
      )}

      <Card>
        <HStack className="justify-between">
          <VStack space="xs">
            <Typography variant="caption" color="muted">
              {t('clubInviteCodeLabel')}
            </Typography>
            <Typography variant="title" color="default" className="tracking-[4px]">
              {club.inviteCode}
            </Typography>
          </VStack>
          {isOwner && (
            <Pressable className="p-2 active:opacity-60" onPress={handleRegenerate} disabled={busy}>
              <Icon name="refresh" size="lg" />
            </Pressable>
          )}
        </HStack>
      </Card>

      {isOwner && (
        <Pressable className="items-center py-3" onPress={handleDelete} disabled={busy}>
          <Typography variant="body" color="destructive" className="font-bold">
            {t('clubDeleteClub')}
          </Typography>
        </Pressable>
      )}
    </ScrollPage>
  );
}
