import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
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
import { initialsFromName } from '../../core/initials';
import { SessionChat } from './SessionChat';
import { getSportModule } from '../../sports/registry';
import { offerPush } from '../../core/notifications/offerPush';
import { useSessionChatUnread } from '../../core/messages/useSessionChatUnread';
import { UnreadCount } from '../messages/UnreadCount';
import { SessionContactOrganizer } from './SessionContactOrganizer';
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
  // Set when arriving from the Inbox tab (DP-013 Contact Organizer) — the
  // memberUserId of the specific thread to jump straight into.
  openContactWith?: string;
  // Open on this tab instead of Details: Matches after a match, or the tab
  // a notification is about (DP-018).
  initialTab?: SessionTabLink;
};

// Tabs a link can open a Session on (`?tab=`).
export type SessionTabLink = 'participants' | 'payment' | 'matches';
const LINKABLE_TABS: SessionTabLink[] = ['participants', 'payment', 'matches'];

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

function participantInitials(p: SessionParticipant): string {
  return initialsFromName(p.displayName || p.username || p.guestName || '?');
}

// Border color mirrors the status's meaning, not a text-color pairing —
// checked-in (teal), registered (blue), requested/waitlist (amber, still
// pending), checked-out/cancelled/no-show (muted slate).
function participantAvatarBorderClass(status: SessionParticipant['status']): string {
  if (status === 'checked_in') return 'border-teal-500';
  if (status === 'registered') return 'border-info dark:border-info-dark';
  if (status === 'requested' || status === 'waitlist') return 'border-heat';
  return 'border-border-strong dark:border-border-strong-dark';
}

export function SessionDetailScreen({ sessionId, onBack, onAddMatch, onOpenMatch, onEdit, onDiscarded, openContactWith, initialTab }: Props) {
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [activities, setActivities] = useState<ActivityDetail[]>([]);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Set when the Session itself couldn't be loaded — shown instead of an
  // endless spinner.
  const [loadFailed, setLoadFailed] = useState(false);
  // DP-019: the participant whose profile an organizer has opened.
  const [profileParticipant, setProfileParticipant] = useState<SessionParticipant | null>(null);
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
  const [activeTab, setActiveTab] = useState<'details' | 'payment' | 'configuration' | 'participants' | 'matches' | 'chat'>(
    initialTab && LINKABLE_TABS.includes(initialTab) ? initialTab : 'details'
  );
  const [now, setNow] = useState(() => Date.now());
  // Opened on the Payment tab (e.g. from a link) for a free Session, which
  // has none: show Details instead.
  useEffect(() => {
    if (session?.priceModel === 'free' && activeTab === 'payment') setActiveTab('details');
  }, [session?.priceModel, activeTab]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const chatUnread = useSessionChatUnread(sessionId, profile?.id, activeTab === 'chat');
  // DP-013 Contact Organizer — a private thread, separate from the Chat
  // tab's group SessionChat. contactVisible opens the modal; when arriving
  // from the Inbox (openContactWith set), it opens straight into that
  // member's thread instead of the organizer's thread list.
  const [contactVisible, setContactVisible] = useState(Boolean(openContactWith));
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
        // Only organizers may read a Recurring Schedule (DP-007), so for
        // a member this is refused — and it only feeds the "Every <day>"
        // label. It must never take the whole page down with it.
        sess.recurringScheduleId
          ? getRecurringSchedule(sess.clubId, sess.recurringScheduleId).catch(() => null)
          : Promise.resolve(null),
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
      setLoadFailed(false);
      return { sess, parts, acts: finalActs };
    } catch {
      // Keep whatever is showing; with nothing loaded yet, say so.
      setLoadFailed(true);
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
  // DP-022: matches can start once the Session is In Progress, or from
  // `matchesOpenAt` (shortly before the start time). `now` ticks each
  // minute so the Start buttons appear on their own.
  const matchesOpen =
    session?.status === 'in_progress' ||
    (session?.status === 'open' && !!session.matchesOpenAt && now >= new Date(session.matchesOpenAt).getTime());

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
    appAlert(t('activityRegenerateConfirmTitle'), t('activityRegenerateConfirmDesc'), [
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
      // DP-018: a good moment to offer push — they'll want to hear back.
      offerPush(lang, t);
    } finally {
      setBusy(false);
    }
  }

  function handleRequestToJoin() {
    if (busy || strictLevelBlocked) return;
    if (hasLevelRequirement && session?.skillLevelEnforcement === 'guidance' && !withinLevelRange) {
      appAlert(
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
    appAlert(t('sessionCancelMyParticipationConfirmTitle'), t('sessionCancelMyParticipationConfirmDesc'), [
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
    appAlert(t('sessionCheckOutConfirmTitle'), t('sessionCheckOutConfirmDesc'), [
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
    appAlert(t('sessionRemoveParticipantConfirmTitle'), t('sessionRemoveParticipantConfirmDesc'), [
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
    appAlert(t('sessionDiscardConfirmTitle'), t('sessionDiscardConfirmDesc'), [
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
    appAlert(t('sessionCancelConfirmTitle'), t('sessionCancelConfirmDesc'), [
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
    appAlert(t('sessionMenuTitle'), undefined, options);
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

  // The caller's own place in this Session — ask to join, the state of
  // their request, check in, or give up their spot. Shown on the Details
  // tab (where the Session opens) and on Participants, so joining never
  // depends on finding the right tab.
  //
  // DP-002 Join Approval: requested -> waitlist (needs payment) ->
  // registered (approved) -> checked_in. Only 'registered', within
  // the Check-In Window, can self check-in. Nothing here renders
  // while still Draft — check-in status/actions only make sense
  // once the Session is published. Every non-terminal status below
  // 'Checked In' status itself is already visible on the caller's
  // own avatar in the Participants list, so this area stays a
  // small Check Out link rather than repeating a "Checked In"
  // banner. Cancel/Check Out are self-service (DP-002) — give up
  // the queue spot voluntarily, the participant's own counterpart
  // to the organizer's Remove action.
  function renderMyParticipation() {
    if (!session) return null;
    return (
      <>
        {isPublished &&
          (myParticipant?.status === 'checked_in' ? (
            isSessionActive && (
              <Pressable className="items-center py-1 self-center active:opacity-60" onPress={handleCheckOut} disabled={busy}>
                <Text className="text-ink-muted dark:text-ink-muted-dark font-bold text-sm">{t('sessionCheckOut')}</Text>
              </Pressable>
            )
          ) : myParticipant?.status === 'requested' ? (
            <VStack className="gap-2">
              <Box className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-2xl p-4 items-center">
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionRequestedNotice')}</Text>
              </Box>
              <Pressable className="items-center py-1 active:opacity-60" onPress={handleCancelMyParticipation} disabled={busy}>
                <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
              </Pressable>
            </VStack>
          ) : myParticipant?.status === 'waitlist' ? (
            <VStack className="gap-2">
              <Box className="bg-heat-tint dark:bg-heat-tint-dark rounded-2xl p-4 items-center">
                <Text className="text-sm text-ink dark:text-ink-dark">{t('sessionWaitlistedNotice')}</Text>
              </Box>
              <Pressable className="items-center py-1 active:opacity-60" onPress={handleCancelMyParticipation} disabled={busy}>
                <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
              </Pressable>
            </VStack>
          ) : myParticipant?.status === 'registered' ? (
            isSessionActive && (
              <VStack className="gap-2">
                {checkInWindowOpen ? (
                  <Button size="xl" className="w-full" isDisabled={busy} onPress={handleCheckIn}>
                    <ButtonText>{t('sessionCheckIn')}</ButtonText>
                  </Button>
                ) : (
                  <Box className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-2xl p-4 items-center">
                    <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionCheckInWindowClosed')}</Text>
                  </Box>
                )}
                <Pressable className="items-center py-1 active:opacity-60" onPress={handleCancelMyParticipation} disabled={busy}>
                  <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
                </Pressable>
              </VStack>
            )
          ) : (
            // Never joined, or cancelled their own spot earlier — either
            // way they can ask (again).
            (!myParticipant || myParticipant.status === 'cancelled') &&
            isSessionActive && (
              <VStack className="gap-2">
                <Button
                  size="xl"
                  className="w-full"
                  isDisabled={busy || strictLevelBlocked}
                  onPress={handleRequestToJoin}
                >
                  <ButtonText>{t('sessionRequestToJoin')}</ButtonText>
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
      </>
    );
  }

  if (!session && !loading && loadFailed) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
        <VStack className="px-5 pt-4 gap-4">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>
          <Text className="text-2xl font-black text-ink dark:text-ink-dark">{t('sessionLoadFailedTitle')}</Text>
          <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionLoadFailedDesc')}</Text>
          <Pressable
            className="self-start px-4 py-2 rounded-lg bg-heat active:bg-heat-strong"
            onPress={() => {
              setLoading(true);
              load();
            }}
          >
            <Text className="font-sans-semibold text-on-heat">{t('retry')}</Text>
          </Pressable>
        </VStack>
      </SafeAreaView>
    );
  }

  if (loading || !session) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark items-center justify-center">
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
          {/* Organizers tap a member to see who they are (DP-019) —
              what they need when deciding on a request to join. */}
          <Pressable
            disabled={!(isOwnerOrAdmin && p.userId)}
            onPress={() => setProfileParticipant(p)}
            className="active:opacity-70"
            accessibilityLabel={isOwnerOrAdmin && p.userId ? t('playerProfileOpen') : undefined}
          >
            <Box
              className={`w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 ${participantAvatarBorderClass(p.status)}`}
            >
              <Text className="text-base font-extrabold text-ink-muted dark:text-ink-muted-dark">{participantInitials(p)}</Text>
            </Box>
          </Pressable>
          {canRemove && (
            <Pressable
              onPress={() => handleDeleteParticipant(p)}
              disabled={busy}
              hitSlop={8}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger dark:bg-danger-dark items-center justify-center active:opacity-70"
            >
              <Icon name="close" size="xs" color="onDark" />
            </Pressable>
          )}
          {action && isOwnerOrAdmin && isSessionActive && (
            <Pressable
              onPress={action.onPress}
              disabled={busy}
              hitSlop={8}
              className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-heat items-center justify-center active:opacity-70"
            >
              <Icon name={action.icon} size="xs" color="onBrand" />
            </Pressable>
          )}
        </Box>
        <Text className="text-xs font-bold text-ink dark:text-ink-dark text-center mt-1" numberOfLines={2}>
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
        <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark">{label}</Text>
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

  // A free Session has nothing to pay or confirm (DP-002 v0.24.0): no
  // Payment tab.
  const isFree = session.priceModel === 'free';
  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'details', label: t('sessionTabDetails') },
    { key: 'participants', label: t('sessionTabParticipants') },
    ...(isFree ? [] : [{ key: 'payment' as const, label: t('sessionTabPayment') }]),
    { key: 'configuration', label: t('sessionTabConfiguration') },
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
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
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
            <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{formatSessionDateTime(session.startsAt)}</Text>
          )}
        </VStack>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              className={`items-center px-4 py-3.5 rounded-xl ${activeTab === tab.key ? 'bg-ink dark:bg-ink-dark' : 'bg-surface-sunken dark:bg-surface-sunken-dark'}`}
              onPress={() => setActiveTab(tab.key)}
              hitSlop={4}
            >
              <HStack className="items-center gap-1.5">
                <Text className={`text-sm font-bold ${activeTab === tab.key ? 'text-surface dark:text-surface-dark' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                  {tab.label}
                </Text>
                {tab.key === 'chat' && <UnreadCount count={chatUnread} />}
              </HStack>
            </Pressable>
          ))}
        </ScrollView>
      </VStack>

      {activeTab === 'chat' ? (
        <VStack className="flex-1">
          {/* DP-013 Contact Organizer — private, distinct from the group
              chat below. Everyone gets the same entry point; the modal
              itself decides member (own thread) vs. organizer (thread
              list) view. */}
          <Pressable
            className="flex-row items-center justify-between px-5 py-3 border-b border-border dark:border-border-dark active:opacity-70"
            onPress={() => setContactVisible(true)}
          >
            <HStack className="items-center gap-2">
              <Icon name="mail-outline" size="sm" color="secondary" />
              <Text className="font-bold text-ink-muted dark:text-ink-muted-dark">{t('sessionContactEntry')}</Text>
            </HStack>
            <Icon name="chevron-forward" size="sm" color="muted" />
          </Pressable>
          <SessionChat sessionId={sessionId} session={session} />
        </VStack>
      ) : (
      <ScrollView
        contentContainerClassName="px-5 pt-6 pb-6 gap-5"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {activeTab === 'details' && (
          <VStack className="gap-5">
            <VStack className="gap-1">
              {club && (
                <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{club.name}</Text>
              )}
              {recurringSchedule && (
                <HStack className="items-center gap-1">
                  <Icon name="repeat-outline" size="xs" color="muted" />
                  <Text className="text-ink-muted dark:text-ink-muted-dark">
                    {t('sessionRecurringEvery', weekdayLabel(recurringSchedule.recurrenceRule.weekday, t))}
                  </Text>
                </HStack>
              )}
              {session.lifecycleStatus === 'draft' && (
                <VStack className="gap-1.5 mb-1">
                  <Box className="bg-info-tint dark:bg-info-tint-dark rounded-full px-2.5 py-1 self-start">
                    <Text className="text-xs font-extrabold text-info dark:text-info-dark tracking-wide">
                      {t('sessionStatusDraft').toUpperCase()}
                    </Text>
                  </Box>
                  <Text className="text-sm text-ink dark:text-ink-dark">{t('sessionDraftNotice')}</Text>
                </VStack>
              )}
              {session.location && (
                <HStack className="items-center gap-1">
                  <Icon name="location-outline" size="xs" color="muted" />
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{session.location}</Text>
                </HStack>
              )}
              {hasLevelRequirement && (
                <Text className="text-sm font-bold text-heat-strong dark:text-heat-strong-dark">
                  {(minLevel?.name ?? '?') + '–' + (maxLevel?.name ?? '?')} ·{' '}
                  {session.skillLevelEnforcement === 'strict' ? t('skillLevelEnforcementStrict') : t('skillLevelEnforcementGuidance')}
                </Text>
              )}
            </VStack>

            {renderMyParticipation()}

            <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
              <VStack className="gap-2">
                <HStack className="justify-between">
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionSportLabel')}</Text>
                  <Text className="font-bold text-ink dark:text-ink-dark">
                    {session.sport === 'tennis' ? t('sportTennis') : session.sport}
                  </Text>
                </HStack>
                {session.activityType && (
                  <HStack className="justify-between">
                    <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionActivityTypeLabel')}</Text>
                    <Text className="font-bold text-ink dark:text-ink-dark">{activityTypeLabel(session.activityType, t)}</Text>
                  </HStack>
                )}
                {session.startsAt && (
                  <HStack className="justify-between">
                    <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionDateLabel')}</Text>
                    <Text className="font-bold text-ink dark:text-ink-dark">{formatSessionDateTime(session.startsAt)}</Text>
                  </HStack>
                )}
                {session.durationMinutes != null && (
                  <HStack className="justify-between">
                    <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionDurationLabel')}</Text>
                    <Text className="font-bold text-ink dark:text-ink-dark">
                      {t('sessionDurationHours', Math.round(session.durationMinutes / 60))}
                    </Text>
                  </HStack>
                )}
                {session.priceModel === 'free' ? (
                  <HStack className="justify-between">
                    <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionPriceLabel')}</Text>
                    <Text className="font-bold text-ink dark:text-ink-dark">{t('sessionPriceFreeDisplay')}</Text>
                  </HStack>
                ) : session.priceModel === 'per_person' ? (
                  <HStack className="justify-between">
                    <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionPriceLabel')}</Text>
                    <Text className="font-bold text-ink dark:text-ink-dark">
                      {session.pricePerPerson != null ? t('sessionPricePerPersonDisplay', formatIDR(session.pricePerPerson)) : '—'}
                    </Text>
                  </HStack>
                ) : (
                  session.totalPrice != null && (
                    <>
                      <HStack className="justify-between">
                        <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionSplitBillTotalLabel')}</Text>
                        <Text className="font-bold text-ink dark:text-ink-dark">{formatIDR(session.totalPrice)}</Text>
                      </HStack>
                      <HStack className="justify-between">
                        <Text className="text-ink-muted dark:text-ink-muted-dark">
                          {t('sessionSplitBillPerPersonLabel', session.joinedCount)}
                        </Text>
                        <Text className="font-bold text-ink dark:text-ink-dark">
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
              className="bg-surface dark:bg-surface-dark rounded-2xl p-4 active:opacity-70"
            >
              <HStack className="justify-between items-center">
                <Text className="font-bold text-ink dark:text-ink-dark">
                  {session.maxParticipants != null
                    ? t('sessionJoinedCountLineMax', session.joinedCount, session.maxParticipants)
                    : t('sessionJoinedCountLine', session.joinedCount)}
                </Text>
                <Icon name="chevron-forward" size="sm" color="muted" />
              </HStack>
            </Pressable>

            {session.description && (
              <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-1">
                <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">
                  {t('sessionDescriptionSectionTitle')}
                </Text>
                <Text className="text-ink-muted dark:text-ink-muted-dark">{session.description}</Text>
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
              <Box className="bg-info-tint dark:bg-info-tint-dark rounded-xl p-4">
                <Text className="text-sm text-ink dark:text-ink-dark">
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
              <Box className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-2xl p-4">
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionCompletedNotice')}</Text>
              </Box>
            )}

            {session.lifecycleStatus === 'cancelled' && (
              <Box className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
                <Text className="text-sm text-red-800 dark:text-red-300">{t('sessionCancelledNotice')}</Text>
              </Box>
            )}

            <VStack className="gap-2">
              <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{t('sessionOrganizerTitle')}</Text>
              <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
                <VStack className="items-center" style={{ width: 76 }}>
                  <Box className="w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-border dark:border-border-dark">
                    <Text className="text-base font-extrabold text-ink-muted dark:text-ink-muted-dark">
                      {initialsFromName(organizerName)}
                    </Text>
                  </Box>
                  <Text className="text-xs font-bold text-ink dark:text-ink-dark text-center mt-1" numberOfLines={2}>
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
                <Button size="lg" className="w-full" isDisabled={busy} onPress={handlePublish}>
                  <ButtonText>{t('sessionPublish')}</ButtonText>
                </Button>

                <Box className="h-px bg-surface-sunken dark:bg-surface-sunken-dark my-1" />

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
            <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
              <VStack className="gap-2">
                <HStack className="justify-between">
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{t('matchFormat')}</Text>
                  <Text className="font-bold text-ink dark:text-ink-dark">{matchFormatSummary(configMatchFormat, t)}</Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{t('singleDeuce')}</Text>
                  <Text className="font-bold text-ink dark:text-ink-dark">
                    {configSingleDeuce ? t('sessionConfigOn') : t('sessionConfigOff')}
                  </Text>
                </HStack>
              </VStack>
            </Box>

            <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionConfigEditHint')}</Text>

            {canEditConfiguration && (
              <Button variant="outline" size="lg" className="w-full" isDisabled={busy} onPress={() => onEdit(sessionId)}>
                <ButtonText variant="outline">
                  {t('sessionEdit')}
                </ButtonText>
              </Button>
            )}
          </VStack>
        )}

        {activeTab === 'participants' && (
          <VStack className="gap-5">
            {renderMyParticipation()}

            <VStack className="gap-4">
              <HStack className="justify-between items-center">
                <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">
                  {t('sessionParticipantsTitle')}
                </Text>
                <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark">
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
                      {/* An open spot. Organizers can tap it to add someone
                          (hence the "+"); for everyone else it only shows
                          how many spots are left, so it carries no "+" and
                          does nothing — a "+" that can't be pressed reads
                          as broken. */}
                      {canAddParticipant ? (
                        <Pressable
                          onPress={openAddParticipant}
                          className="w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-dashed border-border-strong dark:border-border-strong-dark active:opacity-70"
                          accessibilityLabel={t('sessionAddParticipantTitle')}
                        >
                          <Icon name="add" size="md" color="muted" />
                        </Pressable>
                      ) : (
                        <Box
                          className="w-16 h-16 rounded-full border-2 border-dashed border-border dark:border-border-dark"
                          accessibilityLabel={t('sessionOpenSpot')}
                        />
                      )}
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
              <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionMatchesUnavailableDraft')}</Text>
            ) : (
              <>
                <HStack className="justify-between items-center mb-1">
                  <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">
                    {t('activityQueueTitle')}
                  </Text>
                  {isOwnerOrAdmin && isSessionActive && (
                    <HStack className="gap-1">
                      {canRegenerate && (
                        <Pressable onPress={handleRegenerate} className="px-3 py-2 active:opacity-60" disabled={busy} hitSlop={4}>
                          <Text className="text-sm font-bold text-heat-strong dark:text-heat-strong-dark">{t('activityRegenerateMatches')}</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => onAddMatch(sessionId)} className="px-3 py-2 active:opacity-60" hitSlop={4}>
                        <Text className="text-sm font-bold text-heat-strong dark:text-heat-strong-dark">{t('activityAdd')}</Text>
                      </Pressable>
                    </HStack>
                  )}
                </HStack>
                {activities.length === 0 ? (
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{t('activityEmptyQueue')}</Text>
                ) : (
                  activities.map((a) => {
                    // A match's own checked-in players can start it themselves;
                    // owner/admin can start any queued match administratively,
                    // regardless of whether they're checked in (or even playing
                    // at all — an organizer with Host Playing off has no
                    // myParticipant row, and shouldn't be blocked from managing
                    // the queue because of that). Either way, only once matches
                    // are open (DP-022: In Progress, or shortly before the start).
                    const canStart =
                      matchesOpen &&
                      a.status === 'queued' &&
                      (isOwnerOrAdmin ||
                        (myParticipant?.status === 'checked_in' && a.participants.some((p) => p.userId === profile?.id)));
                    // Any checked-in participant of the session (not just this
                    // match's own players) can watch — matches domain.md's Member
                    // permission to "watch live score."
                    const canWatch = isSessionActive && a.status === 'live' && myParticipant?.status === 'checked_in';
                    const isLiveScorer = a.status === 'live' && a.scorerUserId === profile?.id;
                    // A finished match opens its result (score, Share) at any
                    // time; its final score shows on the row, team A first.
                    const isFinished = a.status === 'completed';
                    const finalScore = isFinished ? getSportModule(a.sport)?.formatResult?.(a.result, 'A') : undefined;
                    return (
                      <Pressable
                        key={a.id}
                        disabled={!isFinished}
                        onPress={() => onOpenMatch(a.id)}
                        className="bg-surface dark:bg-surface-dark rounded-2xl p-4 active:opacity-70"
                      >
                        <HStack className="justify-between items-center gap-3">
                          <VStack className="flex-1 gap-1">
                            <Text className="font-bold text-ink dark:text-ink-dark">{activityParticipantNames(a)}</Text>
                            {a.status === 'live' ? (
                              <HStack className="items-center gap-1.5">
                                <Box className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <Text className="text-xs font-extrabold text-red-500 tracking-wide">
                                  {t('activityStatusLive').toUpperCase()}
                                </Text>
                              </HStack>
                            ) : (
                              <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">
                                {a.status === 'queued'
                                  ? t('activityStatusQueued')
                                  : finalScore
                                    ? `${t('activityStatusCompleted')} · ${finalScore}`
                                    : t('activityStatusCompleted')}
                              </Text>
                            )}
                          </VStack>
                          {canStart && (
                            <Button size="sm" onPress={() => onOpenMatch(a.id)}>
                              <ButtonText>{t('activityStart')}</ButtonText>
                            </Button>
                          )}
                          {canWatch && (
                            <Button size="sm" className="bg-red-600" onPress={() => onOpenMatch(a.id)}>
                              <ButtonText>{isLiveScorer ? t('activityResume') : t('activityWatch')}</ButtonText>
                            </Button>
                          )}
                          {isFinished && <Icon name="chevron-forward" size="sm" color="muted" />}
                        </HStack>
                      </Pressable>
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
          <Pressable className="bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
            <Box className="w-10 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center mb-1" />

            {addParticipantStep === 'choose' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">
                  {t('sessionAddParticipantTitle')}
                </Text>
                <Button
                  size="lg"
                  className="w-full"
                  onPress={() => setAddParticipantStep('member')}
                >
                  <ButtonText>{t('sessionAddParticipantMemberOption')}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onPress={() => setAddParticipantStep('guest')}
                >
                  <ButtonText variant="outline">
                    {t('sessionAddParticipantGuestOption')}
                  </ButtonText>
                </Button>
                <Pressable className="items-center py-1 active:opacity-60" onPress={closeAddParticipant}>
                  <Text className="text-ink-muted dark:text-ink-muted-dark font-bold">{t('clubCancel')}</Text>
                </Pressable>
              </VStack>
            )}

            {addParticipantStep === 'member' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">
                  {t('sessionAddMemberLabel')}
                </Text>
                {addableMembers.length === 0 ? (
                  <Text className="text-ink-muted dark:text-ink-muted-dark text-center py-4">
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
                          <Box className="w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-border-strong dark:border-border-strong-dark">
                            <Text className="text-base font-extrabold text-ink-muted dark:text-ink-muted-dark">
                              {initialsFromName(m.displayName || m.username)}
                            </Text>
                          </Box>
                          <Text className="text-xs font-bold text-ink dark:text-ink-dark text-center mt-1" numberOfLines={2}>
                            {m.displayName || m.username}
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </ScrollView>
                )}
                {error && <Text className="text-sm text-red-500">{error}</Text>}
                <Pressable className="items-center py-1 active:opacity-60" onPress={() => setAddParticipantStep('choose')}>
                  <Text className="text-heat-strong dark:text-heat-strong-dark font-bold">{t('back')}</Text>
                </Pressable>
              </VStack>
            )}

            {addParticipantStep === 'guest' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">{t('sessionAddGuest')}</Text>
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
                  size="lg"
                  className="w-full"
                  isDisabled={busy || !guestName.trim()}
                  onPress={handleSubmitGuestFromModal}
                >
                  <ButtonText>{t('sessionAdd')}</ButtonText>
                </Button>
                <Pressable className="items-center py-1 active:opacity-60" onPress={() => setAddParticipantStep('choose')}>
                  <Text className="text-heat-strong dark:text-heat-strong-dark font-bold">{t('back')}</Text>
                </Pressable>
              </VStack>
            )}
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <SessionContactOrganizer
        visible={contactVisible}
        onClose={() => setContactVisible(false)}
        sessionId={sessionId}
        session={session}
        isOwnerOrAdmin={isOwnerOrAdmin}
        myUserId={profile?.id ?? ''}
        initialMemberUserId={openContactWith}
      />
      <PlayerProfileSheet
        userId={profileParticipant?.userId ?? null}
        onClose={() => setProfileParticipant(null)}
        sport={session.sport}
        levelRange={minLevel && maxLevel ? { min: minLevel, max: maxLevel } : undefined}
        actions={
          profileParticipant?.status === 'requested' && profileParticipant.userId && isSessionActive
            ? [
                { label: t('clubJoinRequestDecline'), destructive: true, onPress: () => handleDeleteParticipant(profileParticipant) },
                { label: t('clubJoinRequestApprove'), onPress: () => handleApprove(profileParticipant.userId!) },
              ]
            : undefined
        }
      />
    </SafeAreaView>
  );
}
