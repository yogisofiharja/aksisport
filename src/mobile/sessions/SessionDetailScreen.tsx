import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
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
import { getClub, getClubPreview, listMembers } from '../../core/clubs/api';
import { getRecurringSchedule } from '../../core/recurringSchedules/api';
import { createActivity, deleteActivity, listActivities } from '../../core/activities/api';
import { listMySkillLevels, listSkillLevels } from '../../core/skillLevels/api';
import { availableToPlay, generateFairRound } from '../../core/sessions/matchGenerator';
import { buildGeneratedMatchPayload } from '../../core/activities/buildGeneratedMatchPayload';
import { formatSessionWhen, isWithinCheckInWindow } from '../../core/sessions/sessionSchedule';
import { offerPush } from '../../core/notifications/offerPush';
import { useSessionChatUnread } from '../../core/messages/useSessionChatUnread';
import { Segmented } from '../../design-system/ui/Segmented';
import { SessionContactOrganizer } from './SessionContactOrganizer';
import { PaymentSummary } from './SessionPayment';
import { PlayerRowSheet } from './PlayerRowSheet';
import { AddParticipantSheet, type AddParticipantStep } from './AddParticipantSheet';
import { MyParticipation } from './tabs/MyParticipation';
import { DetailsTab } from './tabs/DetailsTab';
import { PlayersTab } from './tabs/PlayersTab';
import { MatchesTab } from './tabs/MatchesTab';
import { MatchSetup } from './tabs/MatchSetup';
import { ChatTab } from './tabs/ChatTab';
import { LiveStrip } from './LiveStrip';
import { NativeShareModal, type NativeShareData } from '../../components/NativeShareModal';
import { buildMatchShareData, teamNamesFromState } from '../../core/activities/shareData';
import { ActionBar } from '../../design-system/layout/ActionBar';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { umpireStart } from '../../core/sessions/umpire';
import { priceLabel } from './sessionDisplay';
import { formatIDR } from '../../core/currency';
import { SessionMenuSheet } from './SessionMenuSheet';
import { UmpireSheet } from './UmpireSheet';
import { Sheet } from '../../design-system/feedback/Sheet';
import { sessionLink, shareLink } from '../../platform/shareLink';
import type { MatchFormat, MatchMode, MatchState } from '../../sports/tennis/scoringEngine';
import { minParticipants } from '../../sports/tennis/rules';
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
import { AppBar } from '../../design-system/layout/AppBar';

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

// Tabs a link can open a Session on (`?tab=`). 'participants' and
// 'payment' are the names notifications have always used; both now open
// Players, where payments live (DP-024).
export type SessionTabLink = 'participants' | 'payment' | 'matches';

type SessionTab = 'details' | 'players' | 'matches' | 'chat';

function tabFromLink(link?: SessionTabLink): SessionTab | null {
  if (link === 'participants' || link === 'payment') return 'players';
  if (link === 'matches') return 'matches';
  return null;
}

// DP-024: the Session opens where people need it — Details before it
// starts, Matches once it is under way, Results (the Matches tab) after.
function defaultTabFor(status: Session['lifecycleStatus']): SessionTab {
  return status === 'in_progress' || status === 'completed' ? 'matches' : 'details';
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
  // The row whose ⋯ an organizer opened on Players (payment, Remove).
  const [rowMenuParticipant, setRowMenuParticipant] = useState<SessionParticipant | null>(null);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DP-008: only fetched when the session actually has a Skill Level
  // requirement — sportLevels resolves the range's ids to names/ranks,
  // myLevel is the caller's own level for the session's sport (if set).
  const [sportLevels, setSportLevels] = useState<SkillLevel[]>([]);
  const [myLevel, setMyLevel] = useState<UserSkillLevel | undefined>(undefined);
  // Details · Players · Matches · Chat (DP-024) — the session name and date
  // stay pinned in the header outside the tab body, so switching tabs
  // never loses which session you're looking at. Until someone picks a tab
  // (or a link names one), the tab follows the lifecycle.
  const [chosenTab, setActiveTab] = useState<SessionTab | null>(() => tabFromLink(initialTab));
  const activeTab: SessionTab = chosenTab ?? (session ? defaultTabFor(session.lifecycleStatus) : 'details');
  const [now, setNow] = useState(() => Date.now());
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
  const [club, setClub] = useState<Pick<Club, 'id' | 'name'> | null>(null);
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
      // A Session-only participant (DP-028) can't read the Community's own
      // routes: no member list, and its public preview for the name.
      const visitor = sess.viewerRole === 'visitor';
      const [parts, members, acts, clubResult, schedule] = await Promise.all([
        listParticipants(sessionId),
        visitor ? Promise.resolve([] as ClubMember[]) : listMembers(sess.clubId),
        listActivities(sessionId),
        visitor ? getClubPreview(sess.clubId) : getClub(sess.clubId),
        // Only organizers may read a Recurring Schedule (DP-007), so for
        // a member this is refused — and it only feeds the "Every <day>"
        // label. It must never take the whole page down with it.
        sess.recurringScheduleId
          ? getRecurringSchedule(sess.clubId, sess.recurringScheduleId).catch(() => null)
          : Promise.resolve(null),
      ]);
      const myRole = sess.viewerRole ?? members.find((m) => m.userId === profile?.id)?.role;
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

  // DP-027: a live match can be scored until the Session ends, and on a
  // Completed Session for its grace hour (scoringClosesAt).
  const scoringOpen =
    session?.status === 'completed'
      ? !!session.scoringClosesAt && now < new Date(session.scoringClosesAt).getTime()
      : session?.status !== 'cancelled';

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

  // The organizer's ⋯ menu (DP-024): Edit, Match setup, Umpire (DP-023),
  // Share, and Cancel session last in its own group. Edit and Cancel live here rather than
  // inline — both are easy to misclick in the same scroll flow as
  // everything else; handleCancel still asks to confirm.
  const [menuVisible, setMenuVisible] = useState(false);
  // DP-026: the share card for a finished match in the list.
  const [shareData, setShareData] = useState<NativeShareData | null>(null);

  function handleShareMatch(a: ActivityDetail) {
    const result = a.result as MatchState | undefined;
    if (!result?.config) return;
    setShareData(buildMatchShareData(result, teamNamesFromState(result)));
  }
  const [matchSetupVisible, setMatchSetupVisible] = useState(false);
  // DP-023: who umpires the Session (owners/admins).
  const [umpireSheetVisible, setUmpireSheetVisible] = useState(false);

  async function handleShareSession() {
    if (!session) return;
    const outcome = await shareLink(sessionLink(sessionId), session.name || session.sport);
    if (outcome === 'copied') appAlert(t('sessionLinkCopiedTitle'), t('sessionLinkCopiedDesc'));
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
  const [addParticipantStep, setAddParticipantStep] = useState<AddParticipantStep>('closed');

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

  if (!session && !loading && loadFailed) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
        <AppBar onBack={onBack} />
        <VStack className="px-5 pt-4 gap-4">
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
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
        <AppBar onBack={onBack} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
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

  // Organizer is session.createdBy — shown separately from Participants
  // regardless of whether they're also playing (hostPlaying). If they are,
  // they additionally appear in Participants (Confirmed, via the
  // registration DP-004 does at creation — same as any other add, not
  // checked in until they actually show up) — this entry is about
  // identity, not participation.
  const myParticipation = (
    <MyParticipation
      session={session}
      myParticipant={myParticipant}
      isPublished={isPublished}
      isSessionActive={isSessionActive}
      checkInWindowOpen={checkInWindowOpen}
      busy={busy}
      strictLevelBlocked={strictLevelBlocked}
      hasMyLevel={Boolean(myLevel)}
      minLevelName={minLevel?.name}
      maxLevelName={maxLevel?.name}
      onCancelMyParticipation={handleCancelMyParticipation}
      onCheckOut={handleCheckOut}
    />
  );

  const organizerMember = members.find((m) => m.userId === session.createdBy);
  // A visitor has no member list; the host is usually among the players.
  const organizerPlayer = participants.find((p) => p.userId === session.createdBy);
  const organizerName =
    organizerMember?.displayName || organizerMember?.username || organizerPlayer?.displayName || organizerPlayer?.username || t('sessionHostLabel');

  // A free Session has nothing to pay or confirm (DP-002 v0.24.0).
  const isFree = session.priceModel === 'free';
  // Four tabs that always fit on a phone (DP-024). While In Progress the
  // Session is about its matches, so they lead; after it, Matches reads
  // as Results.
  const tabOptions: Record<SessionTab, { value: SessionTab; label: string; count?: number }> = {
    details: { value: 'details', label: t('sessionTabDetails') },
    players: { value: 'players', label: t('sessionTabParticipants') },
    matches: { value: 'matches', label: session.lifecycleStatus === 'completed' ? t('sessionTabResults') : t('sessionTabMatches') },
    chat: { value: 'chat', label: t('sessionTabChat'), count: chatUnread },
  };
  // One bottom action (DP-024) that follows the viewer's state: Request to
  // join → Pay → Check in → (the umpire only) Start my match / Start next
  // match; organizers with no step of their own get Generate matches. Nothing when no action applies — never
  // a disabled button.
  // DP-023: only the Session's umpire starts matches — their own when it
  // is next, otherwise the next one in the queue.
  const isUmpire = session.umpireUserId === profile?.id;
  const umpireNext = isUmpire ? umpireStart({ activities, participants, courtCount: session.courtCount, myUserId: profile?.id }) : undefined;
  const spotsLeft = session.maxParticipants != null ? Math.max(0, session.maxParticipants - session.joinedCount) : undefined;
  // The bottom bar's fact is short: the amount alone ("Rp 50.000"), or
  // "Free" / "Split bill".
  const priceText =
    session.priceModel === 'per_person' && session.pricePerPerson != null ? formatIDR(session.pricePerPerson) : priceLabel(session, t);
  let bottomAction: { label: string; onPress: () => void; fact?: { label: string; value: string } } | undefined;
  if (isSessionActive && isPublished) {
    const status = myParticipant?.status;
    if ((!myParticipant || status === 'cancelled') && !strictLevelBlocked && !isOwnerOrAdmin) {
      bottomAction = {
        label: t('sessionRequestToJoin'),
        onPress: handleRequestToJoin,
        fact: priceText ? { label: spotsLeft != null ? t('sessionSpotsLeft', spotsLeft) : '', value: priceText } : undefined,
      };
    } else if (status === 'waitlist' && !isFree) {
      // Pay = upload the receipt; the transfer details are at the top of
      // Players.
      bottomAction = { label: t('sessionPay'), onPress: () => setActiveTab('players') };
    } else if (status === 'registered' && checkInWindowOpen) {
      bottomAction = { label: t('sessionCheckIn'), onPress: handleCheckIn };
    } else if (umpireNext && matchesOpen) {
      const { activityId } = umpireNext;
      bottomAction = {
        label: umpireNext.kind === 'mine' ? t('sessionStartMyMatch') : t('sessionStartNextMatch'),
        onPress: () => onOpenMatch(activityId),
      };
    } else if (isOwnerOrAdmin && generationEligible) {
      bottomAction = { label: t('sessionGenerateMatches'), onPress: () => onAddMatch(sessionId) };
    }
  }

  // DP-024 (v0.29.0): an organizer who isn't a player joins from the ⋯
  // menu, through the same flow as Request to join — their bottom action
  // stays Generate matches. Not once they play, nor when the Session is
  // Full, Completed or Cancelled (or still a Draft, or a Strict Skill
  // Level rules them out, where Request to join can't succeed either).
  const canJoinAsPlayer =
    isOwnerOrAdmin &&
    isPublished &&
    (!myParticipant || myParticipant.status === 'cancelled') &&
    !strictLevelBlocked &&
    session.lifecycleStatus !== 'full' &&
    session.lifecycleStatus !== 'completed' &&
    session.lifecycleStatus !== 'cancelled';

  const tabOrder: SessionTab[] =
    session.lifecycleStatus === 'in_progress' ? ['matches', 'players', 'chat', 'details'] : ['details', 'players', 'matches', 'chat'];

  // Match Setup — same editable window as the rest of the Edit Session
  // form (draft, or published-not-yet-started): matches "Editing, Draft or
  // published-not-started" in docs/current/lifecycle-session.md.
  const canEditConfiguration = isOwnerOrAdmin && (session.lifecycleStatus === 'draft' || session.status === 'open');

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      {/* Persistent header — name, then "Wed 22 Oct · 19:00 · Community"
          as the context line, pinned above the tab body (outside the
          ScrollView) so switching tabs never loses which session you're
          looking at. */}
      <AppBar
        title={session.name || session.sport}
        context={[formatSessionWhen(session, lang, t('sessionSectionToday')), club?.name].filter(Boolean).join(' · ') || undefined}
        onBack={onBack}
        onMore={isOwnerOrAdmin ? () => setMenuVisible(true) : undefined}
      />
      {session.lifecycleStatus === 'in_progress' && (
        <LiveStrip
          activities={activities}
          participants={participants}
          courtCount={session.courtCount}
          myUserId={profile?.id}
          isOrganizer={isOwnerOrAdmin}
          umpireName={isUmpire ? undefined : session.umpireName}
          onPress={() => setActiveTab('matches')}
        />
      )}
      <VStack className="px-5 pt-3 pb-4">
        <Segmented options={tabOrder.map((key) => tabOptions[key])} value={activeTab} onChange={setActiveTab} />
      </VStack>

      {activeTab === 'chat' ? (
        <ChatTab sessionId={sessionId} session={session} onOpenContact={() => setContactVisible(true)} />
      ) : (
      <ScrollView
        contentContainerClassName="px-5 pt-6 pb-6 gap-5"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {activeTab === 'details' && (
          <DetailsTab
            session={session}
            club={club}
            recurringSchedule={recurringSchedule}
            minLevel={minLevel ?? undefined}
            maxLevel={maxLevel ?? undefined}
            hasLevelRequirement={hasLevelRequirement}
            organizerName={organizerName}
            isMeOrganizer={session.createdBy === profile?.id}
            dateText={formatSessionWhen(session, lang, t('sessionSectionToday'))}
            isOwnerOrAdmin={isOwnerOrAdmin}
            busy={busy}
            myParticipation={myParticipation}
            onOpenPlayers={() => setActiveTab('players')}
            onPublish={handlePublish}
            onDiscard={handleDiscard}
          />
        )}

        {activeTab === 'players' && (
          <PlayersTab
            session={session}
            participants={participants}
            myUserId={profile?.id}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isSessionActive={isSessionActive}
            checkInWindowOpen={checkInWindowOpen}
            canAddParticipant={canAddParticipant}
            placeholderCount={placeholderCount}
            busy={busy}
            myParticipation={myParticipation}
            paymentSummary={
              isFree ? undefined : (
                <PaymentSummary sessionId={sessionId} session={session} myParticipant={myParticipant} onParticipantsChanged={load} />
              )
            }
            onOpenProfile={setProfileParticipant}
            onOpenRowMenu={setRowMenuParticipant}
            onCheckInParticipant={handleCheckInParticipant}
            onApprove={handleApprove}
            onAddParticipant={openAddParticipant}
          />
        )}

        {activeTab === 'matches' && (
          <MatchesTab
            activities={activities}
            isPublished={isPublished}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isUmpire={isUmpire}
            isSessionActive={isSessionActive}
            isCompleted={session.lifecycleStatus === 'completed'}
            scoringOpen={scoringOpen}
            matchesOpen={matchesOpen}
            canRegenerate={canRegenerate}
            busy={busy}
            myUserId={profile?.id}
            myParticipant={myParticipant}
            onRegenerate={handleRegenerate}
            onAddMatch={() => onAddMatch(sessionId)}
            onOpenMatch={onOpenMatch}
            onShareMatch={handleShareMatch}
          />
        )}
      </ScrollView>
      )}

      {/* One bottom action (DP-024), following the viewer's state. Not on
          Chat, which has its own compose bar at the bottom. */}
      {bottomAction && activeTab !== 'chat' && (
        <ActionBar fact={bottomAction.fact}>
          <Button size="lg" isDisabled={busy} onPress={bottomAction.onPress}>
            <ButtonText>{bottomAction.label}</ButtonText>
          </Button>
        </ActionBar>
      )}

      <SessionMenuSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          ...(canJoinAsPlayer
            ? [{ key: 'join', icon: 'person-add-outline' as const, label: t('sessionJoinAsPlayer'), onPress: handleRequestToJoin }]
            : []),
          ...(canEditConfiguration
            ? [{ key: 'edit', icon: 'create-outline' as const, label: t('sessionEdit'), opensMore: true, onPress: () => onEdit(sessionId) }]
            : []),
          {
            key: 'setup',
            icon: 'options-outline' as const,
            label: t('sessionMatchSetup'),
            hint: t('sessionMatchSetupHint'),
            opensMore: true,
            onPress: () => setMatchSetupVisible(true),
          },
          ...(isSessionActive && isPublished
            ? [
                {
                  key: 'umpire',
                  icon: 'flag-outline' as const,
                  label: t('umpire'),
                  hint: session.umpireName,
                  opensMore: true,
                  onPress: () => setUmpireSheetVisible(true),
                },
              ]
            : []),
          { key: 'share', icon: 'share-outline' as const, label: t('sessionShareLink'), onPress: handleShareSession },
          ...(isSessionActive && isPublished
            ? [
                {
                  key: 'cancel',
                  icon: 'close-circle-outline' as const,
                  label: t('sessionCancel'),
                  hint: t('sessionCancelHint'),
                  destructive: true,
                  onPress: handleCancel,
                },
              ]
            : []),
        ]}
      />
      <Sheet visible={matchSetupVisible} onClose={() => setMatchSetupVisible(false)} title={t('sessionMatchSetup')}>
        <MatchSetup
          session={session}
          canEdit={canEditConfiguration}
          busy={busy}
          onEdit={() => {
            setMatchSetupVisible(false);
            onEdit(sessionId);
          }}
        />
      </Sheet>

      {isOwnerOrAdmin && profile && (
        <UmpireSheet
          visible={umpireSheetVisible}
          session={session}
          myUserId={profile.id}
          myName={profile.displayName || profile.username}
          onClose={() => setUmpireSheetVisible(false)}
          onChanged={(updated) => {
            setSession(updated);
            load();
          }}
        />
      )}

      <PlayerRowSheet
        sessionId={sessionId}
        session={session}
        participant={rowMenuParticipant}
        isOwnerOrAdmin={isOwnerOrAdmin}
        canRemove={isOwnerOrAdmin && isSessionActive}
        myUserId={profile?.id}
        busy={busy}
        onClose={() => setRowMenuParticipant(null)}
        onConfirmPayment={handleConfirmPayment}
        onRemove={handleDeleteParticipant}
      />

      <NativeShareModal data={shareData} onClose={() => setShareData(null)} />

      <AddParticipantSheet
        step={addParticipantStep}
        onStep={setAddParticipantStep}
        onClose={closeAddParticipant}
        addableMembers={addableMembers}
        busy={busy}
        error={error}
        guestName={guestName}
        onGuestName={setGuestName}
        onPickMember={handlePickMemberFromModal}
        onSubmitGuest={handleSubmitGuestFromModal}
      />

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
