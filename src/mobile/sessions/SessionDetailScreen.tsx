import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import {
  addGuestParticipant,
  approveParticipant,
  cancelSession,
  checkIn,
  checkInParticipant,
  confirmParticipantPayment,
  deleteParticipant,
  getSession,
  listParticipants,
  publishSession,
  registerForSession,
} from '../../core/sessions/api';
import { listMembers } from '../../core/clubs/api';
import { createActivity, deleteActivity, listActivities } from '../../core/activities/api';
import { listMySkillLevels, listSkillLevels } from '../../core/skillLevels/api';
import { availableToPlay, generateFairRound } from '../../core/sessions/matchGenerator';
import { buildGeneratedMatchPayload } from '../../core/activities/buildGeneratedMatchPayload';
import { formatSessionDateTime, isWithinCheckInWindow } from '../../core/sessions/sessionSchedule';
import type { MatchFormat, MatchMode } from '../../sports/tennis/scoringEngine';
import { minParticipants } from '../../sports/tennis/rules';
import type { ActivityDetail, ClubMember, Session, SessionParticipant, SkillLevel, UserSkillLevel } from '../../core/api/types';

type Props = {
  sessionId: string;
  onBack: () => void;
  onAddMatch: (sessionId: string) => void;
  onOpenMatch: (activityId: string) => void;
};

function activityParticipantNames(activity: ActivityDetail): string {
  const names = (team: 'A' | 'B') =>
    activity.participants.filter((p) => p.team === team).map((p) => p.displayName || p.username || p.guestName).join(' / ');
  return `${names('A')} vs ${names('B')}`;
}

function activityTypeLabel(id: string, t: (key: string) => string): string {
  if (id === 'single') return t('activityTypeSingle');
  if (id === 'double') return t('activityTypeDouble');
  if (id === 'class') return t('activityTypeClass');
  return id;
}

// DP-002 Join Approval: requested -> waitlist -> registered -> checked_in.
function participantStatusLabel(status: SessionParticipant['status'], t: (key: string) => string): string {
  if (status === 'requested') return t('sessionRequested');
  if (status === 'waitlist') return t('sessionWaitlisted');
  if (status === 'checked_in') return t('sessionCheckedIn');
  if (status === 'checked_out') return t('sessionCheckedOutStatus');
  if (status === 'cancelled') return t('sessionCancelledStatus');
  if (status === 'no_show') return t('sessionNoShowStatus');
  return t('sessionRegistered');
}

export function SessionDetailScreen({ sessionId, onBack, onAddMatch, onOpenMatch }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [activities, setActivities] = useState<ActivityDetail[]>([]);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DP-008: only fetched when the session actually has a Skill Level
  // requirement — sportLevels resolves the range's ids to names/ranks,
  // myLevel is the caller's own level for the session's sport (if set).
  const [sportLevels, setSportLevels] = useState<SkillLevel[]>([]);
  const [myLevel, setMyLevel] = useState<UserSkillLevel | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const sess = await getSession(sessionId);
      const [parts, members, acts] = await Promise.all([
        listParticipants(sessionId),
        listMembers(sess.clubId),
        listActivities(sessionId),
      ]);
      setSession(sess);
      setParticipants(parts);
      setActivities(acts);
      setMembers(members);
      const myRole = members.find((m) => m.userId === profile?.id)?.role;
      setIsOwnerOrAdmin(myRole === 'owner' || myRole === 'admin');
      if (sess.skillLevelMinId && sess.skillLevelMaxId) {
        const [levels, mine] = await Promise.all([listSkillLevels(sess.sport), listMySkillLevels()]);
        setSportLevels(levels);
        setMyLevel(mine.find((l) => l.sport === sess.sport));
      }
    } catch {
      // leave stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [sessionId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const myParticipant = participants.find((p) => p.userId === profile?.id);

  // DP-008: undefined range fields mean this getter is only meaningful
  // when session has a requirement — callers already gate on that.
  const minLevel = session && sportLevels.find((l) => l.id === session.skillLevelMinId);
  const maxLevel = session && sportLevels.find((l) => l.id === session.skillLevelMaxId);
  const hasLevelRequirement = Boolean(session?.skillLevelMinId && session?.skillLevelMaxId);
  const withinLevelRange = Boolean(
    myLevel && minLevel && maxLevel && myLevel.skillLevelRank >= minLevel.rank && myLevel.skillLevelRank <= maxLevel.rank
  );
  const strictLevelBlocked = hasLevelRequirement && session?.skillLevelEnforcement === 'strict' && !withinLevelRange;

  // A Cancelled or Completed Session is over — no action (check-in, add
  // match, add guest, start/watch a match) makes sense anymore. Already-
  // recorded facts (who checked in, past matches) stay visible; only the
  // action affordances are hidden.
  const isSessionActive = session?.status !== 'cancelled' && session?.status !== 'completed';

  // Check-in (self, host-initiated, or adding a guest) is only allowed
  // from 1 hour before the Session starts until it ends — mirrors the
  // server's authoritative checkInWindowOpen guard, just for hiding/
  // disabling the UI affordance before a request would 403 anyway.
  const checkInWindowOpen = Boolean(session && isWithinCheckInWindow(session));

  // Regenerate matches: only for single/double Sessions (a "match" concept
  // doesn't apply to a 'class' Session), only once there's something queued
  // to replace, and only when at least one checked-in player isn't covered
  // by any currently queued match — otherwise there's nothing to fix.
  const checkedInParticipants = participants.filter((p) => p.status === 'checked_in');
  const queuedActivities = activities.filter((a) => a.status === 'queued');
  const liveActivities = activities.filter((a) => a.status === 'live');
  const generationEligible = session?.activityType === 'single' || session?.activityType === 'double';
  const canRegenerate =
    isSessionActive &&
    generationEligible &&
    queuedActivities.length > 0 &&
    availableToPlay(checkedInParticipants, queuedActivities.concat(liveActivities)).length > 0;

  async function doRegenerate() {
    if (!session) return;
    setBusy(true);
    try {
      for (const a of queuedActivities) {
        await deleteActivity(a.id);
      }
      const sessionMode: MatchMode = session.activityType === 'double' ? 'double' : 'single';
      const matchFormat: MatchFormat = (session.defaultMatchFormat as MatchFormat) ?? { type: 'open' };
      // Regenerate the same number of matches that were just deleted —
      // predictable, and the organizer can always Generate Matches again
      // for more.
      const round = generateFairRound(
        checkedInParticipants,
        liveActivities,
        activities,
        minParticipants(sessionMode),
        queuedActivities.length
      );
      for (const m of round) {
        const { config, participants: parts } = buildGeneratedMatchPayload(m, sessionMode, matchFormat, true, checkedInParticipants);
        await createActivity(sessionId, config, parts);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function handleRegenerate() {
    if (busy) return;
    Alert.alert(t('activityRegenerateConfirmTitle'), t('activityRegenerateConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('activityRegenerateConfirm'), onPress: doRegenerate },
    ]);
  }

  // DP-002 Join Approval: requesting to join is now the "joining" moment
  // (Strict Skill Level is enforced server-side at /register, not
  // /checkin) — so the Guidance-mode confirm lives here, not on check-in.
  async function doRequestToJoin() {
    setBusy(true);
    try {
      await registerForSession(sessionId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function handleRequestToJoin() {
    if (busy || strictLevelBlocked) return;
    if (hasLevelRequirement && session?.skillLevelEnforcement === 'guidance' && !withinLevelRange) {
      Alert.alert(
        t('skillLevelGuidanceConfirmTitle'),
        t('skillLevelGuidanceConfirmDesc', minLevel?.name ?? '', maxLevel?.name ?? ''),
        [
          { text: t('clubCancel'), style: 'cancel' },
          { text: t('clubConfirm'), onPress: doRequestToJoin },
        ]
      );
      return;
    }
    doRequestToJoin();
  }

  // Only reachable once approved (status='registered') and within the
  // Check-In Window — SelfCheckIn on the server guards this too.
  async function handleCheckIn() {
    if (busy) return;
    setBusy(true);
    try {
      await checkIn(sessionId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  // Host-initiated check-in: club members not yet checked in to this
  // Session (e.g. a walk-in who hasn't opened the app) — owner/admin can
  // check them in directly, same upsert self check-in uses. Deliberately
  // excludes the caller themselves (they already have the big Check In
  // button above) and anyone already checked in.
  const notCheckedInMembers = members.filter(
    (m) => m.userId !== profile?.id && !participants.some((p) => p.userId === m.userId && p.status === 'checked_in')
  );

  async function handleCheckInMember(userId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await checkInParticipant(sessionId, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  // DP-002 Join Approval, owner/admin actions.
  async function handleApprove(userId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await approveParticipant(sessionId, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPayment(userId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmParticipantPayment(sessionId, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  async function doDeleteParticipant(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteParticipant(sessionId, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteParticipant(p: SessionParticipant) {
    if (busy) return;
    Alert.alert(t('sessionRemoveParticipantConfirmTitle'), t('sessionRemoveParticipantConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('sessionRemoveParticipant'), style: 'destructive', onPress: () => p.userId && doDeleteParticipant(p.userId) },
    ]);
  }

  async function handlePublish() {
    if (busy) return;
    setBusy(true);
    try {
      await publishSession(sessionId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    setBusy(true);
    try {
      await cancelSession(sessionId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  // DP-001: Cancelled is reachable from any non-terminal state (draft,
  // open, in_progress) — the backend's guarded transition already allows
  // this, this screen just didn't expose a trigger for it before now.
  function handleCancel() {
    if (busy) return;
    Alert.alert(t('sessionCancelConfirmTitle'), t('sessionCancelConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('sessionCancelConfirm'), style: 'destructive', onPress: doCancel },
    ]);
  }

  async function handleAddGuest() {
    const name = guestName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addGuestParticipant(sessionId, name);
      setGuestName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>

        <VStack className="gap-1">
          <Heading size="2xl">{session.name || session.sport}</Heading>
          {session.location && <Text className="text-slate-500 dark:text-slate-400">{session.location}</Text>}
          {hasLevelRequirement && (
            <Text className="text-sm font-bold text-blue-600">
              {(minLevel?.name ?? '?') + '–' + (maxLevel?.name ?? '?')} ·{' '}
              {session.skillLevelEnforcement === 'strict' ? t('skillLevelEnforcementStrict') : t('skillLevelEnforcementGuidance')}
            </Text>
          )}
        </VStack>

        <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-3">
          <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">{t('sessionDetailsTitle')}</Text>
          <VStack className="gap-2">
            <HStack className="justify-between">
              <Text className="text-slate-500 dark:text-slate-400">{t('sessionSportLabel')}</Text>
              <Text className="font-bold text-slate-900 dark:text-white">
                {session.sport === 'tennis' ? t('sportTennis') : session.sport}
              </Text>
            </HStack>
            {session.activityType && (
              <HStack className="justify-between">
                <Text className="text-slate-500 dark:text-slate-400">{t('sessionActivityTypeLabel')}</Text>
                <Text className="font-bold text-slate-900 dark:text-white">{activityTypeLabel(session.activityType, t)}</Text>
              </HStack>
            )}
            {session.startsAt && (
              <HStack className="justify-between">
                <Text className="text-slate-500 dark:text-slate-400">{t('sessionDateLabel')}</Text>
                <Text className="font-bold text-slate-900 dark:text-white">{formatSessionDateTime(session.startsAt)}</Text>
              </HStack>
            )}
            {session.durationMinutes != null && (
              <HStack className="justify-between">
                <Text className="text-slate-500 dark:text-slate-400">{t('sessionDurationLabel')}</Text>
                <Text className="font-bold text-slate-900 dark:text-white">
                  {t('sessionDurationHours', Math.round(session.durationMinutes / 60))}
                </Text>
              </HStack>
            )}
            <HStack className="justify-between">
              <Text className="text-slate-500 dark:text-slate-400">{t('sessionCapacityLabel')}</Text>
              <Text className="font-bold text-slate-900 dark:text-white">
                {session.maxParticipants != null ? `${session.joinedCount}/${session.maxParticipants}` : session.joinedCount}
              </Text>
            </HStack>
          </VStack>
          {session.description && (
            <VStack className="gap-1 pt-1">
              <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
                {t('sessionDescriptionSectionTitle')}
              </Text>
              <Text className="text-slate-700 dark:text-slate-300">{session.description}</Text>
            </VStack>
          )}
        </Box>

        {/* DP-001: a draft session is invisible to members until published
            — minimal affordance so the create-session flow isn't a dead
            end; not the full Draft-editing experience described in the
            product decision (courts/pricing/duplicate), just the one
            action needed to avoid silently breaking session creation. */}
        {isOwnerOrAdmin && session.status === 'draft' && (
          <Box className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 gap-3">
            <Text className="text-sm text-amber-800 dark:text-amber-300">{t('sessionDraftNotice')}</Text>
            <Button size="sm" className="rounded-xl bg-amber-600" isDisabled={busy} onPress={handlePublish}>
              <ButtonText className="text-white">{t('sessionPublish')}</ButtonText>
            </Button>
          </Box>
        )}

        {session.status === 'cancelled' && (
          <Box className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
            <Text className="text-sm text-red-800 dark:text-red-300">{t('sessionCancelledNotice')}</Text>
          </Box>
        )}

        {/* DP-002 Join Approval: requested -> waitlist (needs payment) ->
            registered (approved) -> checked_in. Only 'registered', within
            the Check-In Window, can self check-in. */}
        {myParticipant?.status === 'checked_in' ? (
          <Box className="bg-teal-100 dark:bg-teal-900/30 rounded-2xl p-4 items-center">
            <Text className="text-teal-700 dark:text-teal-400 font-bold">{t('sessionCheckedIn')}</Text>
          </Box>
        ) : myParticipant?.status === 'requested' ? (
          <Box className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 items-center">
            <Text className="text-sm text-slate-500 dark:text-slate-400">{t('sessionRequestedNotice')}</Text>
          </Box>
        ) : myParticipant?.status === 'waitlist' ? (
          <Box className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 items-center">
            <Text className="text-sm text-amber-800 dark:text-amber-300">{t('sessionWaitlistedNotice')}</Text>
          </Box>
        ) : myParticipant?.status === 'registered' ? (
          isSessionActive &&
          (checkInWindowOpen ? (
            <Button action="secondary" size="xl" className="w-full rounded-2xl bg-blue-600" isDisabled={busy} onPress={handleCheckIn}>
              <ButtonText className="text-white text-lg">{t('sessionCheckIn')}</ButtonText>
            </Button>
          ) : (
            <Box className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 items-center">
              <Text className="text-sm text-slate-500 dark:text-slate-400">{t('sessionCheckInWindowClosed')}</Text>
            </Box>
          ))
        ) : (
          !myParticipant &&
          isSessionActive && (
            <VStack className="gap-2">
              <Button
                action="secondary"
                size="xl"
                className="w-full rounded-2xl bg-blue-600"
                isDisabled={busy || strictLevelBlocked}
                onPress={handleRequestToJoin}
              >
                <ButtonText className="text-white text-lg">{t('sessionRequestToJoin')}</ButtonText>
              </Button>
              {strictLevelBlocked && (
                <Text className="text-sm text-red-500">
                  {myLevel
                    ? t('skillLevelStrictBlockedOutOfRange', minLevel?.name ?? '', maxLevel?.name ?? '')
                    : t('skillLevelStrictBlockedNotSet', session.sport)}
                </Text>
              )}
            </VStack>
          )
        )}

        <VStack className="gap-2">
          <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
            {t('sessionParticipantsTitle')}
          </Text>
          {participants.map((p) => (
            <Box key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-2">
              <HStack className="justify-between items-center">
                <Text className="font-bold text-slate-900 dark:text-white">
                  {p.displayName || p.username || p.guestName}
                  {p.userId === profile?.id ? ` (${t('sessionYou')})` : ''}
                </Text>
                <Text className="text-xs text-slate-400">{participantStatusLabel(p.status, t)}</Text>
              </HStack>
              {isOwnerOrAdmin && isSessionActive && p.userId && (
                <HStack className="gap-4">
                  {p.status === 'requested' && (
                    <Pressable onPress={() => handleApprove(p.userId!)} disabled={busy} className="active:opacity-60">
                      <Text className="text-sm font-bold text-blue-600">{t('sessionApprove')}</Text>
                    </Pressable>
                  )}
                  {p.status === 'waitlist' && (
                    <Pressable onPress={() => handleConfirmPayment(p.userId!)} disabled={busy} className="active:opacity-60">
                      <Text className="text-sm font-bold text-blue-600">{t('sessionConfirmPayment')}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => handleDeleteParticipant(p)} disabled={busy} className="active:opacity-60">
                    <Text className="text-sm font-bold text-red-500">{t('sessionRemoveParticipant')}</Text>
                  </Pressable>
                </HStack>
              )}
            </Box>
          ))}
        </VStack>

        <VStack className="gap-2">
          <HStack className="justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
              {t('activityQueueTitle')}
            </Text>
            {isOwnerOrAdmin && isSessionActive && (
              <HStack className="gap-3">
                {canRegenerate && (
                  <Pressable onPress={handleRegenerate} className="active:opacity-60" disabled={busy}>
                    <Text className="text-sm font-bold text-amber-600">{t('activityRegenerateMatches')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => onAddMatch(sessionId)} className="active:opacity-60">
                  <Text className="text-sm font-bold text-blue-600">{t('activityAdd')}</Text>
                </Pressable>
              </HStack>
            )}
          </HStack>
          {activities.length === 0 ? (
            <Text className="text-slate-500 dark:text-slate-400">{t('activityEmptyQueue')}</Text>
          ) : (
            activities.map((a) => {
              const canStart =
                isSessionActive &&
                a.status === 'queued' &&
                myParticipant?.status === 'checked_in' &&
                a.participants.some((p) => p.userId === profile?.id);
              // Any checked-in participant of the session (not just this
              // match's own players) can watch — matches domain.md's Member
              // permission to "watch live score."
              const canWatch = isSessionActive && a.status === 'live' && myParticipant?.status === 'checked_in';
              const isLiveScorer = a.status === 'live' && a.scorerUserId === profile?.id;
              return (
                <Box key={a.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                  <HStack className="justify-between items-center gap-3">
                    <VStack className="flex-1 gap-1">
                      <Text className="font-bold text-slate-900 dark:text-white">{activityParticipantNames(a)}</Text>
                      {a.status === 'live' ? (
                        <HStack className="items-center gap-1.5">
                          <Box className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <Text className="text-xs font-extrabold text-red-500 tracking-wide">
                            {t('activityStatusLive').toUpperCase()}
                          </Text>
                        </HStack>
                      ) : (
                        <Text className="text-xs text-slate-400">
                          {a.status === 'queued' ? t('activityStatusQueued') : t('activityStatusCompleted')}
                        </Text>
                      )}
                    </VStack>
                    {canStart && (
                      <Button size="sm" className="rounded-xl bg-amber-600" onPress={() => onOpenMatch(a.id)}>
                        <ButtonText className="text-white">{t('activityStart')}</ButtonText>
                      </Button>
                    )}
                    {canWatch && (
                      <Button size="sm" className="rounded-xl bg-red-600" onPress={() => onOpenMatch(a.id)}>
                        <ButtonText className="text-white">{isLiveScorer ? t('activityResume') : t('activityWatch')}</ButtonText>
                      </Button>
                    )}
                  </HStack>
                </Box>
              );
            })
          )}
        </VStack>

        {isOwnerOrAdmin && isSessionActive && checkInWindowOpen && notCheckedInMembers.length > 0 && (
          <VStack className="gap-2 pt-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionCheckInMemberLabel')}</Text>
            <HStack className="gap-2" style={{ flexWrap: 'wrap' }}>
              {notCheckedInMembers.map((m) => (
                <Pressable
                  key={m.userId}
                  onPress={() => handleCheckInMember(m.userId)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-full border-[1.5px] bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 active:opacity-60"
                >
                  <Text className="font-bold text-slate-900 dark:text-white">{m.displayName || m.username}</Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>
        )}

        {isOwnerOrAdmin && isSessionActive && checkInWindowOpen && (
          <VStack className="gap-2 pt-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionAddGuest')}</Text>
            <HStack className="gap-2">
              <Input className="flex-1">
                <InputField
                  placeholder={t('sessionAddGuestPlaceholder')}
                  value={guestName}
                  onChangeText={setGuestName}
                  onSubmitEditing={handleAddGuest}
                />
              </Input>
              <Button action="secondary" className="rounded-xl bg-blue-600" onPress={handleAddGuest}>
                <ButtonText className="text-white">{t('sessionAdd')}</ButtonText>
              </Button>
            </HStack>
            {error && <Text className="text-sm text-red-500">{error}</Text>}
          </VStack>
        )}

        {isOwnerOrAdmin && (session.status === 'draft' || session.status === 'open' || session.status === 'in_progress') && (
          <Pressable className="items-center py-3" onPress={handleCancel} disabled={busy}>
            <Text className="text-red-500 font-bold">{t('sessionCancel')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
