import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView } from 'react-native';
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
  addRegisteredParticipant,
  approveParticipant,
  cancelParticipation,
  cancelSession,
  checkIn,
  checkInParticipantById,
  checkOut,
  confirmParticipantPayment,
  deleteParticipant,
  discardDraftSession,
  getSession,
  listParticipants,
  publishSession,
  registerForSession,
} from '../../core/sessions/api';
import { getClub, listMembers } from '../../core/clubs/api';
import { getRecurringSchedule } from '../../core/recurringSchedules/api';
import { createActivity, deleteActivity, listActivities } from '../../core/activities/api';
import { listMySkillLevels, listSkillLevels } from '../../core/skillLevels/api';
import { availableToPlay, generateFairRound } from '../../core/sessions/matchGenerator';
import { buildGeneratedMatchPayload } from '../../core/activities/buildGeneratedMatchPayload';
import { formatSessionDateTime, isWithinCheckInWindow } from '../../core/sessions/sessionSchedule';
import { formatIDR } from '../../core/currency';
import { matchFormatSummary } from '../../core/sessions/matchFormatSummary';
import { SessionChat } from './SessionChat';
import { SessionPayment } from './SessionPayment';
import type { MatchFormat, MatchMode } from '../../sports/tennis/scoringEngine';
import { minParticipants } from '../../sports/tennis/rules';
import { weekdayLabel } from '../recurringSchedules/weekday';
import type {
  ActivityDetail,
  Club,
  ClubMember,
  RecurringSchedule,
  Session,
  SessionParticipant,
  SkillLevel,
  UserSkillLevel,
} from '../../core/api/types';

type Props = {
  sessionId: string;
  onBack: () => void;
  onAddMatch: (sessionId: string) => void;
  onOpenMatch: (activityId: string) => void;
  onEdit: (sessionId: string) => void;
  onDiscarded: () => void;
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

// Milestone 2: participant avatar circle — initials only for now (no
// avatarUrl on SessionParticipant yet; swap in a real image there once
// one exists, same circle/border shape).
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase();
}

function participantInitials(p: SessionParticipant): string {
  return initialsFromName(p.displayName || p.username || p.guestName || '?');
}

// Border color mirrors the status's meaning, not a text-color pairing —
// checked-in (teal), registered (blue), requested/waitlist (amber, still
// pending), checked-out/cancelled/no-show (muted slate).
function participantAvatarBorderClass(status: SessionParticipant['status']): string {
  if (status === 'checked_in') return 'border-teal-500';
  if (status === 'registered') return 'border-blue-500';
  if (status === 'requested' || status === 'waitlist') return 'border-amber-500';
  return 'border-slate-300 dark:border-slate-600';
}

export function SessionDetailScreen({ sessionId, onBack, onAddMatch, onOpenMatch, onEdit, onDiscarded }: Props) {
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
  // Details/Participants/Matches/Chat — the session name and date stay
  // pinned in the header outside the tab body, so switching tabs never
  // loses which session you're looking at.
  const [activeTab, setActiveTab] = useState<'details' | 'payment' | 'configuration' | 'participants' | 'matches' | 'chat'>('details');
  const [club, setClub] = useState<Club | null>(null);
  // Only set when this Session was generated from a Recurring Schedule
  // (session.recurringScheduleId) — used for the Details tab's "Every
  // <weekday>" line.
  const [recurringSchedule, setRecurringSchedule] = useState<RecurringSchedule | null>(null);

  // Tracks the match-generation-eligible pool (registered or checked_in —
  // matches can be planned before anyone's physically checked in, see
  // core/sessions/matchGenerator.ts) as of the last successful load, as a
  // stable sorted key (userId for members, participant row id for
  // guests) — null until the first load completes, so a fresh page open
  // never triggers a regeneration just because the queue happened to
  // already be stale (only an observed *change* does). Ref rather than
  // state since it's read/written from inside load() itself, not
  // rendered.
  const lastSchedulableKeyRef = useRef<string | null>(null);

  // Returns the freshly fetched session/participants/activities (or
  // undefined on failure) — most callers just want the state update, but
  // some need the up-to-date data immediately, in the same tick (state
  // wouldn't reflect it until the next render).
  const load = useCallback(async () => {
    try {
      const sess = await getSession(sessionId);
      const [parts, members, acts, clubResult, schedule] = await Promise.all([
        listParticipants(sessionId),
        listMembers(sess.clubId),
        listActivities(sessionId),
        getClub(sess.clubId),
        sess.recurringScheduleId ? getRecurringSchedule(sess.clubId, sess.recurringScheduleId) : Promise.resolve(null),
      ]);
      const myRole = members.find((m) => m.userId === profile?.id)?.role;
      const amOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';

      // Matches are generated from a snapshot of the eligible pool
      // (registered or checked_in) — if that pool changes afterward for
      // ANY reason (someone registers, checks in, checks out, cancels, is
      // removed, marked no-show...) while matches are still queued
      // (unplayed), the queue no longer reflects who's actually
      // available. Auto-regenerate rather than leaving it for the
      // organizer to notice and fix manually via Regenerate. Compared as
      // a full set, not just a count, so a same-size swap (one player
      // out, a different one in) still triggers this. Owner/admin only —
      // matches Regenerate's own permission requirement, and avoids every
      // viewer's device racing to regenerate the same queue.
      let finalActs = acts;
      const freshSchedulable = parts.filter((p) => p.status === 'registered' || p.status === 'checked_in');
      const schedulableKey = freshSchedulable
        .map((p) => p.userId ?? p.id)
        .sort()
        .join(',');
      const generationEligibleNow = sess.activityType === 'single' || sess.activityType === 'double';
      if (
        lastSchedulableKeyRef.current !== null &&
        lastSchedulableKeyRef.current !== schedulableKey &&
        amOwnerOrAdmin &&
        generationEligibleNow
      ) {
        const freshQueued = acts.filter((a) => a.status === 'queued');
        if (freshQueued.length > 0) {
          const freshLive = acts.filter((a) => a.status === 'live');
          await regenerateQueuedMatches(sess, freshSchedulable, freshQueued, freshLive, acts);
          finalActs = await listActivities(sessionId);
        }
      }
      lastSchedulableKeyRef.current = schedulableKey;

      setSession(sess);
      setParticipants(parts);
      setActivities(finalActs);
      setMembers(members);
      setIsOwnerOrAdmin(amOwnerOrAdmin);
      setClub(clubResult);
      setRecurringSchedule(schedule);
      if (sess.skillLevelMinId && sess.skillLevelMaxId) {
        const [levels, mine] = await Promise.all([listSkillLevels(sess.sport), listMySkillLevels()]);
        setSportLevels(levels);
        setMyLevel(mine.find((l) => l.sport === sess.sport));
      }
      return { sess, parts, acts: finalActs };
    } catch {
      // leave stale state; user can back out and retry
      return undefined;
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

  // Draft is pre-publish — nothing check-in/match-related is available
  // yet, not even the organizer's own check-in status (explicit product
  // decision, Milestone 2): check-in (self, adding a participant) and
  // match generation all require the Session to already be published.
  const isPublished = session?.lifecycleStatus !== 'draft';

  // Check-in only — moving an already-'registered' participant (self or
  // organizer-initiated) to 'checked_in' — is restricted to 1 hour before
  // the Session starts until it ends. Mirrors the server's authoritative
  // checkInWindowOpen guard, just for hiding/disabling the UI affordance
  // before a request would 403 anyway. Adding a participant to the roster
  // (below) is deliberately NOT restricted to this window — Milestone 2
  // (revised): that now always lands at 'registered', not 'checked_in',
  // so there's no check-in action happening at add time to gate.
  const checkInWindowOpen = Boolean(session && isWithinCheckInWindow(session));

  // Milestone 2 (revised): gates the empty participant-slot placeholders'
  // tap affordance — adding someone to the roster is roster-building, not
  // a check-in action, so unlike checkInWindowOpen above this doesn't
  // require the window. Deliberately does NOT exclude 'in_progress' —
  // organizers still need to add a late-arriving player or a walk-in
  // guest once the Session is already live, same as before.
  const canAddParticipant = isOwnerOrAdmin && isSessionActive && isPublished;

  // Checked-in specifically — for the "Checked In" sub-section display
  // and canStart/canWatch below, which are genuinely about physical
  // presence, not generation eligibility.
  const checkedInParticipants = participants.filter((p) => p.status === 'checked_in');
  // Generation-eligible pool (registered or checked_in — see
  // core/sessions/matchGenerator.ts's module comment): used for Regenerate
  // only, only for single/double Sessions (a "match" concept doesn't apply
  // to a 'class' Session), only once there's something queued to replace,
  // and only when at least one eligible player isn't covered by any
  // currently queued match — otherwise there's nothing to fix.
  const schedulableParticipants = participants.filter((p) => p.status === 'registered' || p.status === 'checked_in');
  const queuedActivities = activities.filter((a) => a.status === 'queued');
  const liveActivities = activities.filter((a) => a.status === 'live');
  const generationEligible = session?.activityType === 'single' || session?.activityType === 'double';
  const canRegenerate =
    isSessionActive &&
    generationEligible &&
    queuedActivities.length > 0 &&
    availableToPlay(schedulableParticipants, queuedActivities.concat(liveActivities)).length > 0;

  // Shared by the manual Regenerate button and the automatic
  // regeneration that follows the eligible pool changing (see load()) —
  // deletes every currently queued match and generates a fresh fair round
  // of the same size from the given (caller-supplied, so it can be
  // freshly-loaded rather than possibly-stale component state) eligible
  // pool. Live/completed matches are untouched either way.
  async function regenerateQueuedMatches(
    sess: Session,
    freshSchedulable: SessionParticipant[],
    freshQueued: ActivityDetail[],
    freshLive: ActivityDetail[],
    freshActivities: ActivityDetail[]
  ) {
    for (const a of freshQueued) {
      await deleteActivity(a.id);
    }
    const sessionMode: MatchMode = sess.activityType === 'double' ? 'double' : 'single';
    const matchFormat: MatchFormat = (sess.defaultMatchFormat as MatchFormat) ?? { type: 'open' };
    // Regenerate the same number of matches that were just deleted —
    // predictable, and the organizer can always Generate Matches again
    // for more.
    const round = generateFairRound(
      freshSchedulable,
      freshLive,
      freshActivities,
      minParticipants(sessionMode),
      freshQueued.length
    );
    for (const m of round) {
      const { config, participants: parts } = buildGeneratedMatchPayload(m, sessionMode, matchFormat, true, freshSchedulable);
      await createActivity(sessionId, config, parts);
    }
  }

  async function doRegenerate() {
    if (!session) return;
    setBusy(true);
    try {
      await regenerateQueuedMatches(session, schedulableParticipants, queuedActivities, liveActivities, activities);
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

  // DP-002: self-service — "I can't make it," reachable while requested,
  // waitlisted, or registered (before actually checking in). Not offered
  // once checked_in — physically present already, Check Out (below) is
  // the equivalent action from there. Confirmed since it gives up the
  // participant's place in line.
  async function doCancelMyParticipation() {
    setBusy(true);
    setError(null);
    try {
      await cancelParticipation(sessionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  function handleCancelMyParticipation() {
    if (busy) return;
    Alert.alert(t('sessionCancelMyParticipationConfirmTitle'), t('sessionCancelMyParticipationConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('sessionCancelMyParticipation'), style: 'destructive', onPress: doCancelMyParticipation },
    ]);
  }

  // DP-002: self-service — "I'm leaving," the checked_in counterpart to
  // Cancel above. load() afterward picks up the checked-in pool change
  // and auto-regenerates any still-queued match this participant was
  // part of, same as an organizer-initiated removal.
  async function doCheckOut() {
    setBusy(true);
    setError(null);
    try {
      await checkOut(sessionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  function handleCheckOut() {
    if (busy) return;
    Alert.alert(t('sessionCheckOutConfirmTitle'), t('sessionCheckOutConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('sessionCheckOut'), style: 'destructive', onPress: doCheckOut },
    ]);
  }

  // Milestone 2 (revised): club members with no participant row at all yet
  // — owner/admin adds one directly to the roster as 'registered' (not
  // checked in). Deliberately excludes the caller themselves (already
  // covered by Host Playing/their own self-service area) and anyone
  // already on the roster in any status (they'd show in a Participants
  // sub-section instead, with their own check-in action if applicable).
  const addableMembers = members.filter(
    (m) => m.userId !== profile?.id && !participants.some((p) => p.userId === m.userId)
  );

  async function handleAddMember(userId: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await addRegisteredParticipant(sessionId, userId);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Milestone 2 (revised): the only action that actually moves a
  // participant to 'checked_in' — by their own row id, so it works for
  // guests too (no user_id to key on). Only reachable within the Check-In
  // Window (server also enforces this).
  async function handleCheckInParticipant(participantId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await checkInParticipantById(sessionId, participantId);
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

  async function doDeleteParticipant(p: SessionParticipant) {
    setBusy(true);
    setError(null);
    try {
      await deleteParticipant(sessionId, p.userId ?? p.id);
      // load() itself detects the checked-in pool changing and
      // auto-regenerates the queue if needed — see its definition.
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
      { text: t('sessionRemoveParticipant'), style: 'destructive', onPress: () => doDeleteParticipant(p) },
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

  async function doDiscard() {
    setBusy(true);
    try {
      await discardDraftSession(sessionId);
      onDiscarded();
    } finally {
      setBusy(false);
    }
  }

  // Hard delete, Draft-only — nobody but the organizer has ever seen this
  // Session, unlike Cancel (which keeps a visible record for a published
  // Session others may have joined). Irreversible, so confirmed via
  // dialog same as Cancel/Remove-participant.
  function handleDiscard() {
    if (busy) return;
    Alert.alert(t('sessionDiscardConfirmTitle'), t('sessionDiscardConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('sessionDiscard'), style: 'destructive', onPress: doDiscard },
    ]);
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

  // Edit/Cancel deliberately live behind a top-right "⋮" menu, not as
  // always-visible buttons on the Details tab — both are easy to
  // misclick when sitting in the same scroll flow as everything else,
  // Cancel especially. Publish/Discard stay inline (Draft-only, and
  // Publish is the primary action while reviewing a Draft, not
  // something to bury). handleCancel above still shows its own confirm
  // dialog once selected here — this menu is a first tap, not the
  // final confirmation.
  function handleSessionMenu() {
    if (busy) return;
    const options: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [];
    if (canEditConfiguration) options.push({ text: t('sessionEdit'), onPress: () => onEdit(sessionId) });
    if (isOwnerOrAdmin && isSessionActive && isPublished) options.push({ text: t('sessionCancel'), style: 'destructive', onPress: handleCancel });
    options.push({ text: t('clubCancel'), style: 'cancel' });
    Alert.alert(t('sessionMenuTitle'), undefined, options);
  }

  async function handleAddGuest(): Promise<boolean> {
    const name = guestName.trim();
    if (!name || busy) return false;
    setBusy(true);
    setError(null);
    try {
      await addGuestParticipant(sessionId, name);
      setGuestName('');
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Milestone 2: tapping an empty participant-slot placeholder opens this
  // chooser (Member vs Guest) instead of the old always-visible "Check in
  // a member" row + separate Add Guest form — same two underlying actions
  // (handleAddMember/handleAddGuest), just triggered from the slot itself
  // and auto-closing on success.
  const [addParticipantStep, setAddParticipantStep] = useState<'closed' | 'choose' | 'member' | 'guest'>('closed');

  function openAddParticipant() {
    if (busy) return;
    setAddParticipantStep('choose');
  }

  function closeAddParticipant() {
    setAddParticipantStep('closed');
    setGuestName('');
  }

  async function handlePickMemberFromModal(userId: string) {
    if (await handleAddMember(userId)) closeAddParticipant();
  }

  async function handleSubmitGuestFromModal() {
    if (await handleAddGuest()) closeAddParticipant();
  }

  if (loading || !session) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // Milestone 2: empty-slot placeholders in the Participants grid — a
  // capped Session shows exactly the remaining quota (e.g. 8 max, 2
  // filled -> 6 placeholders); an uncapped one shows a single generic
  // slot instead (there's no fixed total to visualize), so the add-flow
  // stays reachable either way. Draft has none — nothing to fill in yet.
  // Cancelled/Completed also show none, even with unfilled quota — the
  // Session is over, there's nothing left to add a participant to.
  const placeholderCount =
    !isPublished || !isSessionActive
      ? 0
      : session.maxParticipants != null
        ? Math.max(0, session.maxParticipants - participants.length)
        : 1;

  // Milestone 2: Participants split into sub-sections by status instead of
  // one flat grid — each only rendered when non-empty. `checkedInParticipants`
  // is defined above already (shared with the match-generation logic).
  const confirmedParticipants = participants.filter((p) => p.status === 'registered');
  const waitlistParticipants = participants.filter((p) => p.status === 'waitlist');
  const requestedParticipants = participants.filter((p) => p.status === 'requested');
  const cancelledParticipants = participants.filter((p) => p.status === 'cancelled');
  // checked_out/no_show have no dedicated UI action anywhere in this screen
  // today (see docs/current/api.md) but are still real, reachable status
  // values — shown here rather than silently dropped if they ever occur.
  const otherParticipants = participants.filter((p) => p.status === 'checked_out' || p.status === 'no_show');

  // One line of text under the circle (name only) — a participant's status
  // is already conveyed by which sub-section it's in and the avatar's
  // border color, not a second/third text line. `items-start` on the
  // wrapping HStack (not the Box.tsx HStack default of `items-center`) is
  // what keeps every circle aligned to the same row position regardless of
  // how many lines its own name wraps to, or whether a neighboring slot is
  // a shorter placeholder.
  function renderParticipantCard(p: SessionParticipant, action?: { icon: 'checkmark'; onPress: () => void }) {
    const canRemove = isOwnerOrAdmin && isSessionActive;
    return (
      <VStack key={p.id} className="items-center" style={{ width: 76 }}>
        <Box style={{ position: 'relative' }}>
          <Box
            className={`w-16 h-16 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-700 border-2 ${participantAvatarBorderClass(p.status)}`}
          >
            <Text className="text-base font-extrabold text-slate-600 dark:text-slate-300">{participantInitials(p)}</Text>
          </Box>
          {canRemove && (
            <Pressable
              onPress={() => handleDeleteParticipant(p)}
              disabled={busy}
              hitSlop={8}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center active:opacity-70"
            >
              <Icon name="close" size="xs" color="onBrand" />
            </Pressable>
          )}
          {action && isOwnerOrAdmin && isSessionActive && (
            <Pressable
              onPress={action.onPress}
              disabled={busy}
              hitSlop={8}
              className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-blue-600 items-center justify-center active:opacity-70"
            >
              <Icon name={action.icon} size="xs" color="onBrand" />
            </Pressable>
          )}
        </Box>
        <Text className="text-xs font-bold text-slate-900 dark:text-white text-center mt-1" numberOfLines={2}>
          {p.displayName || p.username || p.guestName}
          {p.userId === profile?.id ? ` (${t('sessionYou')})` : ''}
        </Text>
      </VStack>
    );
  }

  function renderParticipantSection(
    label: string,
    list: SessionParticipant[],
    action?: (p: SessionParticipant) => { icon: 'checkmark'; onPress: () => void }
  ) {
    if (list.length === 0) return null;
    return (
      <VStack className="gap-2">
        <Text className="text-xs font-bold text-slate-400">{label}</Text>
        <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
          {list.map((p) => renderParticipantCard(p, action?.(p)))}
        </HStack>
      </VStack>
    );
  }

  // Organizer is session.createdBy — shown separately from Participants
  // regardless of whether they're also playing (hostPlaying). If they are,
  // they additionally appear in Participants (Confirmed, via the
  // registration DP-004 does at creation — same as any other add, not
  // checked in until they actually show up) — this entry is about
  // identity, not participation.
  const organizerMember = members.find((m) => m.userId === session.createdBy);
  const organizerName = organizerMember?.displayName || organizerMember?.username || t('sessionHostLabel');

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'details', label: t('sessionTabDetails') },
    { key: 'payment', label: t('sessionTabPayment') },
    { key: 'configuration', label: t('sessionTabConfiguration') },
    { key: 'participants', label: t('sessionTabParticipants') },
    { key: 'matches', label: t('sessionTabMatches') },
    { key: 'chat', label: t('sessionTabChat') },
  ];

  // Match Setup — same editable window as the rest of the Edit Session
  // form (draft, or published-not-yet-started): matches "Editing, Draft or
  // published-not-started" in docs/current/lifecycle-session.md.
  const canEditConfiguration = isOwnerOrAdmin && (session.lifecycleStatus === 'draft' || session.status === 'open');
  const configMatchFormat: MatchFormat = (session.defaultMatchFormat as MatchFormat) ?? { type: 'open' };
  const configSingleDeuce = session.defaultSingleDeuce ?? true;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Persistent header — name/date stay pinned above the tab body
          (outside the ScrollView) so switching tabs never loses which
          session you're looking at. */}
      <VStack className="px-5 pt-4 pb-4 gap-3">
        <HStack className="justify-between items-center">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>
          {(canEditConfiguration || (isOwnerOrAdmin && isSessionActive && isPublished)) && (
            <Pressable className="p-2 -mr-2 active:opacity-60" onPress={handleSessionMenu} hitSlop={4}>
              <Icon name="ellipsis-vertical" size="lg" />
            </Pressable>
          )}
        </HStack>
        <VStack className="gap-0.5">
          <Heading size="2xl" numberOfLines={1}>{session.name || session.sport}</Heading>
          {session.startsAt && (
            <Text className="text-sm text-slate-500 dark:text-slate-400">{formatSessionDateTime(session.startsAt)}</Text>
          )}
        </VStack>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              className={`items-center px-4 py-3.5 rounded-xl ${activeTab === tab.key ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
              onPress={() => setActiveTab(tab.key)}
              hitSlop={4}
            >
              <Text className={`text-sm font-bold ${activeTab === tab.key ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </VStack>

      {activeTab === 'chat' ? (
        <SessionChat sessionId={sessionId} session={session} />
      ) : (
      <ScrollView
        contentContainerClassName="px-5 pt-6 pb-6 gap-5"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {activeTab === 'details' && (
          <VStack className="gap-5">
            <VStack className="gap-1">
              {club && (
                <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">{club.name}</Text>
              )}
              {recurringSchedule && (
                <HStack className="items-center gap-1">
                  <Icon name="repeat-outline" size="xs" color="muted" />
                  <Text className="text-slate-500 dark:text-slate-400">
                    {t('sessionRecurringEvery', weekdayLabel(recurringSchedule.recurrenceRule.weekday, t))}
                  </Text>
                </HStack>
              )}
              {session.lifecycleStatus === 'draft' && (
                <VStack className="gap-1.5 mb-1">
                  <Box className="bg-blue-100 dark:bg-blue-900/30 rounded-full px-2.5 py-1 self-start">
                    <Text className="text-xs font-extrabold text-blue-700 dark:text-blue-300 tracking-wide">
                      {t('sessionStatusDraft').toUpperCase()}
                    </Text>
                  </Box>
                  <Text className="text-sm text-blue-800 dark:text-blue-300">{t('sessionDraftNotice')}</Text>
                </VStack>
              )}
              {session.location && (
                <HStack className="items-center gap-1">
                  <Icon name="location-outline" size="xs" color="muted" />
                  <Text className="text-slate-500 dark:text-slate-400">{session.location}</Text>
                </HStack>
              )}
              {hasLevelRequirement && (
                <Text className="text-sm font-bold text-blue-600">
                  {(minLevel?.name ?? '?') + '–' + (maxLevel?.name ?? '?')} ·{' '}
                  {session.skillLevelEnforcement === 'strict' ? t('skillLevelEnforcementStrict') : t('skillLevelEnforcementGuidance')}
                </Text>
              )}
            </VStack>

            <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-3">
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
                {session.priceModel === 'free' ? (
                  <HStack className="justify-between">
                    <Text className="text-slate-500 dark:text-slate-400">{t('sessionPriceLabel')}</Text>
                    <Text className="font-bold text-slate-900 dark:text-white">{t('sessionPriceFreeDisplay')}</Text>
                  </HStack>
                ) : session.priceModel === 'per_person' ? (
                  <HStack className="justify-between">
                    <Text className="text-slate-500 dark:text-slate-400">{t('sessionPriceLabel')}</Text>
                    <Text className="font-bold text-slate-900 dark:text-white">
                      {session.pricePerPerson != null ? t('sessionPricePerPersonDisplay', formatIDR(session.pricePerPerson)) : '—'}
                    </Text>
                  </HStack>
                ) : (
                  session.totalPrice != null && (
                    <>
                      <HStack className="justify-between">
                        <Text className="text-slate-500 dark:text-slate-400">{t('sessionSplitBillTotalLabel')}</Text>
                        <Text className="font-bold text-slate-900 dark:text-white">{formatIDR(session.totalPrice)}</Text>
                      </HStack>
                      <HStack className="justify-between">
                        <Text className="text-slate-500 dark:text-slate-400">
                          {t('sessionSplitBillPerPersonLabel', session.joinedCount)}
                        </Text>
                        <Text className="font-bold text-slate-900 dark:text-white">
                          {session.joinedCount > 0 ? formatIDR(Math.round(session.totalPrice / session.joinedCount)) : '—'}
                        </Text>
                      </HStack>
                    </>
                  )
                )}
              </VStack>
            </Box>

            <Pressable
              onPress={() => setActiveTab('participants')}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 active:opacity-70"
            >
              <HStack className="justify-between items-center">
                <Text className="font-bold text-slate-900 dark:text-white">
                  {session.maxParticipants != null
                    ? t('sessionJoinedCountLineMax', session.joinedCount, session.maxParticipants)
                    : t('sessionJoinedCountLine', session.joinedCount)}
                </Text>
                <Icon name="chevron-forward" size="sm" color="muted" />
              </HStack>
            </Pressable>

            {session.description && (
              <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-1">
                <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
                  {t('sessionDescriptionSectionTitle')}
                </Text>
                <Text className="text-slate-700 dark:text-slate-300">{session.description}</Text>
              </Box>
            )}

            {/* Lifecycle framing (Milestone 2) — session.lifecycleStatus is
                resolved server-side (DP-001/DP-ARCH-003), covers every stage:
                Draft -> Recruiting/Ready/Full -> Live -> Completed, Cancelled
                from any non-terminal state. Answers UX-015's three questions
                (Where am I? What needs my attention? What should I do next?)
                for every stage, not just draft/cancelled as before. */}
            {(session.lifecycleStatus === 'recruiting' ||
              session.lifecycleStatus === 'ready' ||
              session.lifecycleStatus === 'full') && (
              <Box className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4">
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  {session.lifecycleStatus === 'recruiting'
                    ? t('sessionRecruitingNotice', session.joinedCount, minParticipants('single'))
                    : session.lifecycleStatus === 'ready'
                      ? t('sessionReadyNotice')
                      : t('sessionFullNotice')}
                </Text>
              </Box>
            )}

            {/* No manual "Complete Session" action — DP-009's auto-transition
                (starts_at + duration_minutes elapses) is the only path to
                Completed, by explicit product decision. */}
            {session.lifecycleStatus === 'in_progress' && (
              <Box className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
                <HStack className="items-center gap-1.5">
                  <Box className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <Text className="text-xs font-extrabold text-red-500 tracking-wide">{t('sessionLiveNotice').toUpperCase()}</Text>
                </HStack>
              </Box>
            )}

            {session.lifecycleStatus === 'completed' && (
              <Box className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4">
                <Text className="text-sm text-slate-500 dark:text-slate-400">{t('sessionCompletedNotice')}</Text>
              </Box>
            )}

            {session.lifecycleStatus === 'cancelled' && (
              <Box className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
                <Text className="text-sm text-red-800 dark:text-red-300">{t('sessionCancelledNotice')}</Text>
              </Box>
            )}

            <VStack className="gap-2">
              <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">{t('sessionOrganizerTitle')}</Text>
              <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
                <VStack className="items-center" style={{ width: 76 }}>
                  <Box className="w-16 h-16 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-700 border-2 border-blue-500">
                    <Text className="text-base font-extrabold text-slate-600 dark:text-slate-300">
                      {initialsFromName(organizerName)}
                    </Text>
                  </Box>
                  <Text className="text-xs font-bold text-slate-900 dark:text-white text-center mt-1" numberOfLines={2}>
                    {organizerName}
                    {session.createdBy === profile?.id ? ` (${t('sessionYou')})` : ''}
                  </Text>
                </VStack>
              </HStack>
            </VStack>

            {/* DP-001: a draft session is invisible to members until
                published. Edit and Cancel deliberately do NOT live here
                anymore — both moved behind the header's "⋮" menu
                (handleSessionMenu) so they're not sitting in easy reach
                on the tab an organizer scrolls through by default.
                Publish stays inline: it's the primary action while
                reviewing a Draft, not something to bury. Discard also
                stays inline — Draft-only, already a low-prominence text
                link rather than a full-width button. */}
            {isOwnerOrAdmin && session.lifecycleStatus === 'draft' && (
              <VStack className="gap-3">
                <Button action="secondary" size="lg" className="w-full rounded-2xl bg-blue-600" isDisabled={busy} onPress={handlePublish}>
                  <ButtonText className="text-white">{t('sessionPublish')}</ButtonText>
                </Button>

                <Box className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                <Pressable className="items-center py-2 active:opacity-60" onPress={handleDiscard} disabled={busy}>
                  <Text className="text-red-500 font-bold">{t('sessionDiscard')}</Text>
                </Pressable>
              </VStack>
            )}
          </VStack>
        )}

        {/* Payment (Milestone 5) — bank accounts + receipt upload/status.
            Confirm Payment lives here now, not as a badge on the
            Participants tab's Waitlist section. */}
        {activeTab === 'payment' && (
          <SessionPayment
            sessionId={sessionId}
            session={session}
            participants={participants}
            myParticipant={myParticipant}
            isOwnerOrAdmin={isOwnerOrAdmin}
            onConfirmPayment={handleConfirmPayment}
            onParticipantsChanged={load}
          />
        )}

        {/* Match Setup (Configuration tab) — defined once here, reused by
            every Generate Matches / Custom Match action from now on
            instead of being reconfigured each time (AddMatchScreen just
            reads session.defaultMatchFormat/defaultSingleDeuce). Editable
            through the same Edit Session form as everything else on this
            screen, same editable window as Details' own Edit button. */}
        {activeTab === 'configuration' && (
          <VStack className="gap-5">
            <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-3">
              <VStack className="gap-2">
                <HStack className="justify-between">
                  <Text className="text-slate-500 dark:text-slate-400">{t('matchFormat')}</Text>
                  <Text className="font-bold text-slate-900 dark:text-white">{matchFormatSummary(configMatchFormat, t)}</Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-slate-500 dark:text-slate-400">{t('singleDeuce')}</Text>
                  <Text className="font-bold text-slate-900 dark:text-white">
                    {configSingleDeuce ? t('sessionConfigOn') : t('sessionConfigOff')}
                  </Text>
                </HStack>
              </VStack>
            </Box>

            <Text className="text-sm text-slate-500 dark:text-slate-400">{t('sessionConfigEditHint')}</Text>

            {canEditConfiguration && (
              <Button variant="outline" action="secondary" size="lg" className="w-full rounded-2xl" isDisabled={busy} onPress={() => onEdit(sessionId)}>
                <ButtonText variant="outline" action="secondary">
                  {t('sessionEdit')}
                </ButtonText>
              </Button>
            )}
          </VStack>
        )}

        {activeTab === 'participants' && (
          <VStack className="gap-5">
            {/* DP-002 Join Approval: requested -> waitlist (needs payment) ->
                registered (approved) -> checked_in. Only 'registered', within
                the Check-In Window, can self check-in. Nothing here renders
                while still Draft — check-in status/actions only make sense
                once the Session is published. Every non-terminal status below
                'Checked In' status itself is already visible on the caller's
                own avatar in the Participants list, so this area stays a
                small Check Out link rather than repeating a "Checked In"
                banner. Cancel/Check Out are self-service (DP-002) — give up
                the queue spot voluntarily, the participant's own counterpart
                to the organizer's Remove action. */}
            {isPublished &&
              (myParticipant?.status === 'checked_in' ? (
                isSessionActive && (
                  <Pressable className="items-center py-1 self-center active:opacity-60" onPress={handleCheckOut} disabled={busy}>
                    <Text className="text-slate-400 font-bold text-sm">{t('sessionCheckOut')}</Text>
                  </Pressable>
                )
              ) : myParticipant?.status === 'requested' ? (
                <VStack className="gap-2">
                  <Box className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 items-center">
                    <Text className="text-sm text-slate-500 dark:text-slate-400">{t('sessionRequestedNotice')}</Text>
                  </Box>
                  <Pressable className="items-center py-1 active:opacity-60" onPress={handleCancelMyParticipation} disabled={busy}>
                    <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
                  </Pressable>
                </VStack>
              ) : myParticipant?.status === 'waitlist' ? (
                <VStack className="gap-2">
                  <Box className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 items-center">
                    <Text className="text-sm text-amber-800 dark:text-amber-300">{t('sessionWaitlistedNotice')}</Text>
                  </Box>
                  <Pressable className="items-center py-1 active:opacity-60" onPress={handleCancelMyParticipation} disabled={busy}>
                    <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
                  </Pressable>
                </VStack>
              ) : myParticipant?.status === 'registered' ? (
                isSessionActive && (
                  <VStack className="gap-2">
                    {checkInWindowOpen ? (
                      <Button action="secondary" size="xl" className="w-full rounded-2xl bg-blue-600" isDisabled={busy} onPress={handleCheckIn}>
                        <ButtonText className="text-white text-lg">{t('sessionCheckIn')}</ButtonText>
                      </Button>
                    ) : (
                      <Box className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 items-center">
                        <Text className="text-sm text-slate-500 dark:text-slate-400">{t('sessionCheckInWindowClosed')}</Text>
                      </Box>
                    )}
                    <Pressable className="items-center py-1 active:opacity-60" onPress={handleCancelMyParticipation} disabled={busy}>
                      <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
                    </Pressable>
                  </VStack>
                )
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
              ))}

            <VStack className="gap-4">
              <HStack className="justify-between items-center">
                <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
                  {t('sessionParticipantsTitle')}
                </Text>
                <Text className="text-sm font-extrabold text-slate-400">
                  {session.maxParticipants != null ? `${session.joinedCount}/${session.maxParticipants}` : session.joinedCount}
                </Text>
              </HStack>

              {renderParticipantSection(t('sessionSectionCheckedIn'), checkedInParticipants)}
              {renderParticipantSection(
                t('sessionSectionConfirmed'),
                confirmedParticipants,
                checkInWindowOpen ? (p) => ({ icon: 'checkmark', onPress: () => handleCheckInParticipant(p.id) }) : undefined
              )}
              {/* No confirm-payment action here (Milestone 5) — moved to
                  its own Payment tab, alongside the receipt an organizer
                  actually needs to look at before confirming. */}
              {renderParticipantSection(t('sessionSectionWaitlist'), waitlistParticipants)}
              {renderParticipantSection(t('sessionSectionRequested'), requestedParticipants, (p) => ({
                icon: 'checkmark',
                onPress: () => handleApprove(p.userId!),
              }))}
              {renderParticipantSection(t('sessionSectionCancelled'), cancelledParticipants)}
              {renderParticipantSection(t('sessionSectionOther'), otherParticipants)}

              {placeholderCount > 0 && (
                <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
                  {Array.from({ length: placeholderCount }).map((_, i) => (
                    <VStack key={`placeholder-${i}`} className="items-center" style={{ width: 76 }}>
                      <Pressable
                        disabled={!canAddParticipant}
                        onPress={openAddParticipant}
                        className="w-16 h-16 rounded-full items-center justify-center bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 active:opacity-70"
                      >
                        <Icon name="add" size="md" color="muted" />
                      </Pressable>
                    </VStack>
                  ))}
                </HStack>
              )}
            </VStack>
          </VStack>
        )}

        {activeTab === 'matches' && (
          <VStack className="gap-2">
            {!isPublished ? (
              <Text className="text-slate-500 dark:text-slate-400">{t('sessionMatchesUnavailableDraft')}</Text>
            ) : (
              <>
                <HStack className="justify-between items-center mb-1">
                  <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
                    {t('activityQueueTitle')}
                  </Text>
                  {isOwnerOrAdmin && isSessionActive && (
                    <HStack className="gap-1">
                      {canRegenerate && (
                        <Pressable onPress={handleRegenerate} className="px-3 py-2 active:opacity-60" disabled={busy} hitSlop={4}>
                          <Text className="text-sm font-bold text-amber-600">{t('activityRegenerateMatches')}</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => onAddMatch(sessionId)} className="px-3 py-2 active:opacity-60" hitSlop={4}>
                        <Text className="text-sm font-bold text-blue-600">{t('activityAdd')}</Text>
                      </Pressable>
                    </HStack>
                  )}
                </HStack>
                {activities.length === 0 ? (
                  <Text className="text-slate-500 dark:text-slate-400">{t('activityEmptyQueue')}</Text>
                ) : (
                  activities.map((a) => {
                    // A match's own checked-in players can start it themselves;
                    // owner/admin can start any queued match administratively,
                    // regardless of whether they're checked in (or even playing
                    // at all — an organizer with Host Playing off has no
                    // myParticipant row, and shouldn't be blocked from managing
                    // the queue because of that). Either way, a match can only
                    // be started once the Session itself is actually live — not
                    // while still Recruiting/Ready/Full, even if matches were
                    // already generated ahead of the start time.
                    const canStart =
                      session?.status === 'in_progress' &&
                      a.status === 'queued' &&
                      (isOwnerOrAdmin ||
                        (myParticipant?.status === 'checked_in' && a.participants.some((p) => p.userId === profile?.id)));
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
              </>
            )}
          </VStack>
        )}

      </ScrollView>
      )}

      <Modal visible={addParticipantStep !== 'closed'} transparent animationType="slide" onRequestClose={closeAddParticipant}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={closeAddParticipant}>
          <Pressable className="bg-white dark:bg-slate-800 rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
            <Box className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-1" />

            {addParticipantStep === 'choose' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-slate-900 dark:text-white text-center mb-1">
                  {t('sessionAddParticipantTitle')}
                </Text>
                <Button
                  action="secondary"
                  size="lg"
                  className="w-full rounded-2xl bg-blue-600"
                  onPress={() => setAddParticipantStep('member')}
                >
                  <ButtonText className="text-white">{t('sessionAddParticipantMemberOption')}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  size="lg"
                  className="w-full rounded-2xl"
                  onPress={() => setAddParticipantStep('guest')}
                >
                  <ButtonText variant="outline" action="secondary">
                    {t('sessionAddParticipantGuestOption')}
                  </ButtonText>
                </Button>
                <Pressable className="items-center py-1 active:opacity-60" onPress={closeAddParticipant}>
                  <Text className="text-slate-400 font-bold">{t('clubCancel')}</Text>
                </Pressable>
              </VStack>
            )}

            {addParticipantStep === 'member' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-slate-900 dark:text-white text-center mb-1">
                  {t('sessionAddMemberLabel')}
                </Text>
                {addableMembers.length === 0 ? (
                  <Text className="text-slate-500 dark:text-slate-400 text-center py-4">
                    {t('sessionAddParticipantNoMembers')}
                  </Text>
                ) : (
                  <ScrollView style={{ maxHeight: 320 }}>
                    <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
                      {addableMembers.map((m) => (
                        <Pressable
                          key={m.userId}
                          onPress={() => handlePickMemberFromModal(m.userId)}
                          disabled={busy}
                          className="items-center active:opacity-60"
                          style={{ width: 76 }}
                        >
                          <Box className="w-16 h-16 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600">
                            <Text className="text-base font-extrabold text-slate-600 dark:text-slate-300">
                              {initialsFromName(m.displayName || m.username)}
                            </Text>
                          </Box>
                          <Text className="text-xs font-bold text-slate-900 dark:text-white text-center mt-1" numberOfLines={2}>
                            {m.displayName || m.username}
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </ScrollView>
                )}
                {error && <Text className="text-sm text-red-500">{error}</Text>}
                <Pressable className="items-center py-1 active:opacity-60" onPress={() => setAddParticipantStep('choose')}>
                  <Text className="text-blue-600 font-bold">{t('back')}</Text>
                </Pressable>
              </VStack>
            )}

            {addParticipantStep === 'guest' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-slate-900 dark:text-white text-center mb-1">{t('sessionAddGuest')}</Text>
                <Input>
                  <InputField
                    placeholder={t('sessionAddGuestPlaceholder')}
                    value={guestName}
                    onChangeText={setGuestName}
                    onSubmitEditing={handleSubmitGuestFromModal}
                    autoFocus
                  />
                </Input>
                {error && <Text className="text-sm text-red-500">{error}</Text>}
                <Button
                  action="secondary"
                  size="lg"
                  className="w-full rounded-2xl bg-blue-600"
                  isDisabled={busy || !guestName.trim()}
                  onPress={handleSubmitGuestFromModal}
                >
                  <ButtonText className="text-white">{t('sessionAdd')}</ButtonText>
                </Button>
                <Pressable className="items-center py-1 active:opacity-60" onPress={() => setAddParticipantStep('choose')}>
                  <Text className="text-blue-600 font-bold">{t('back')}</Text>
                </Pressable>
              </VStack>
            )}
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
