import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../../components/ui/text';
import { Button, ButtonText } from '../../../components/ui/button';
import {
  addPoint,
  createInitialState,
  endMatchNow,
  getPointLabel,
  getServerTeam,
  MatchConfig,
  MatchState,
  Team,
} from '../../sports/tennis/scoringEngine';
import type { TeamASide, TeamNames } from '../../appTypes';
import type { ActivityParticipant, ClubMember, Session } from '../../core/api/types';
import { getActivity, startActivity, completeActivity, listActivities } from '../../core/activities/api';
import { getSession, setSessionUmpire } from '../../core/sessions/api';
import { listMembers } from '../../core/clubs/api';
import { ApiRequestError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { prefetchAudio, initAudio, playApplause } from '../../audio';
import { cancelSpeech, loadTTSPreferences, speakText, speakTextWithCallback } from '../../tts';
import {
  deleteLiveMatch,
  readLiveMatch,
  pushLiveMatchState,
  subscribeToLiveMatch,
  LiveMatchPayload,
} from '../../sessionSync';
import { isFirebaseReady } from '../../firebase';
import { MobileMatchScreen } from '../MobileMatchScreen';
import { MatchResultScreen } from './MatchResultScreen';
import { MatchFinishedScreen } from './MatchFinishedScreen';
import { ResultSavedScreen } from './ResultSavedScreen';
import { MatchStartScreen } from './MatchStartScreen';
import { MatchOptionsSheet } from './MatchOptionsSheet';
import { UmpireSheet } from '../sessions/UmpireSheet';
import { buildServiceOrder } from '../../core/activities/buildGeneratedMatchPayload';
import { appAlert, toast } from '../../design-system/feedback/appAlert';
import { NativeShareModal } from '../../components/NativeShareModal';
import type { NativeShareData } from '../../components/NativeShareModal';
import { useTranslation } from '../../i18n';
import { buildMatchShareData } from '../../core/activities/shareData';

type Props = {
  activityId: string;
  onDone: () => void;
  // Result saved → Back to session: the Session's Matches / Results tab.
  onBackToSession: (sessionId: string) => void;
  // Result saved → Set up next match: that match's start screen (DP-022).
  onOpenMatch: (activityId: string) => void;
};

function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState;
}

function resolveScorerName(participants: ActivityParticipant[], scorerUserId: string | null): string | null {
  if (!scorerUserId) return null;
  const p = participants.find((p) => p.userId === scorerUserId);
  return p?.displayName || p?.username || null;
}

function normalizeSide(side: string | undefined): TeamASide {
  return side === 'right' ? 'right' : 'left';
}

export function ActivityMatchScreen({ activityId, onDone, onBackToSession, onOpenMatch }: Props) {
  const { t } = useTranslation();
  const { firebaseUser, profile } = useAuth();
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [history, setHistory] = useState<MatchState[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isScorer, setIsScorer] = useState(false);
  const [scorerName, setScorerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nativeShareData, setNativeShareData] = useState<NativeShareData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Opened after it finished (from the Matches list): a back arrow on the
  // result, not "Next match".
  const [openedFinished, setOpenedFinished] = useState(false);
  // DP-022: a match that hasn't started opens on the start screen (sides,
  // first server); its stored config waits here until Start.
  const [pendingConfig, setPendingConfig] = useState<MatchConfig | null>(null);
  const [starting, setStarting] = useState(false);
  const [teamASide, setTeamASide] = useState<TeamASide>('left');
  // DP-025: a match that ended on the court is complete only once the
  // umpire confirms it. True for a match opened already completed; set by
  // Confirm result (scorer) or the live copy's `confirmed` (spectators).
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // The Session's next queued match, offered on Result saved.
  const [nextQueuedId, setNextQueuedId] = useState<string | null>(null);
  // DP-023: the Session (its umpire) and its owners/admins — who may hand
  // umpiring over, and whom the umpire asks.
  const [session, setSession] = useState<Session | null>(null);
  const [organizers, setOrganizers] = useState<ClubMember[]>([]);
  const [reclaiming, setReclaiming] = useState(false);
  const [umpireSheetVisible, setUmpireSheetVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const isOrganizer = organizers.some((m) => m.userId === profile?.id);

  async function loadSession(id: string) {
    const sess = await getSession(id);
    setSession(sess);
    const members = await listMembers(sess.clubId).catch(() => []);
    setOrganizers(members.filter((m) => m.role === 'owner' || m.role === 'admin'));
    return sess;
  }

  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const unsubscribeLiveRef = useRef<(() => void) | null>(null);
  // Read inside the live subscription, which outlives renders.
  const isScorerRef = useRef(false);
  useEffect(() => {
    isScorerRef.current = isScorer;
  }, [isScorer]);

  useEffect(() => {
    prefetchAudio();
    loadTTSPreferences();
  }, []);

  useEffect(() => {
    (async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      try {
        const detail = await getActivity(activityId);
        setSessionId(detail.sessionId);
        sessionIdRef.current = detail.sessionId;
        loadSession(detail.sessionId).catch(() => {});
        const config = detail.config as MatchConfig;

        // Already finished before this device ever opened it — render the
        // stored result directly. Never rely on RTDB for a completed match;
        // the live node may already be gone (see cleanup notes below).
        if (detail.status === 'completed') {
          completedRef.current = true;
          setOpenedFinished(true);
          setConfirmed(true);
          const scorerUserId = detail.scorerUserId ?? null;
          setIsScorer(scorerUserId != null && scorerUserId === profile?.id);
          setScorerName(resolveScorerName(detail.participants, scorerUserId));
          setMatchState((detail.result as MatchState) ?? createInitialState(config));
          setHistory((detail.pointLog as MatchState[] | undefined) ?? []);
          setLoading(false);
          return;
        }

        // Not started yet: the start screen comes first (DP-022).
        if (detail.status === 'queued') {
          setScorerName(null);
          setPendingConfig(config);
          setLoading(false);
          return;
        }

        const scorerUserId = detail.scorerUserId ?? null;
        const iAmScorer = scorerUserId != null && scorerUserId === profile?.id;
        isScorerRef.current = iAmScorer;
        setIsScorer(iAmScorer);
        setScorerName(resolveScorerName(detail.participants, scorerUserId));

        if (iAmScorer) {
          // Reopening a match in progress: carry on from the live copy
          // rather than restarting at 0–0 (and overwriting it). A match
          // that ended but was never confirmed reopens on Match finished
          // (DP-025): nothing lost, nothing saved.
          const saved = await readLiveMatch(activityId);
          if (saved?.matchState) {
            setMatchState(saved.matchState);
            setHistory(saved.history ?? []);
            setTeamASide(normalizeSide(saved.teamASide));
          } else {
            setMatchState(createInitialState(config));
          }
        } else {
          setMatchState(createInitialState(config));
        }
        watchLive();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('activityLoadError'));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsubscribeLiveRef.current?.();
      unsubscribeLiveRef.current = null;
      // Deliberately does NOT delete the live match node here. A scorer
      // backing out of this screen (accidentally, or to reopen later) must
      // not wipe the last known score out from under any spectators — see
      // handleNextMatch for the only explicit deletion path.
    };
  }, [activityId]);

  // Follows the match's live copy for everyone, the umpire included:
  // spectators see each point, and a handover (DP-023) — the server moving
  // the copy's scorerUid — turns the old umpire's device into a spectator
  // and the new umpire's into the scorer, from the current score.
  function watchLive() {
    if (!isFirebaseReady) {
      if (!isScorerRef.current) setError(t('activityLiveUnavailable'));
      return;
    }
    unsubscribeLiveRef.current?.();
    unsubscribeLiveRef.current = subscribeToLiveMatch(activityId, (payload) => {
      if (!payload) return; // no live data yet/anymore — keep last-known local state
      const myUid = firebaseUser?.uid;
      if (isScorerRef.current && payload.scorerUid && myUid && payload.scorerUid !== myUid) handedOff();
      // The scorer's own writes come back here; their state is already right.
      if (isScorerRef.current) return;
      if (payload.matchState) setMatchState(payload.matchState);
      if (payload.history) setHistory(payload.history);
      setTeamASide(normalizeSide(payload.teamASide));
      setConfirmed(Boolean(payload.confirmed));
      // Made the umpire mid-match: score on from here.
      if (payload.scorerUid && myUid && payload.scorerUid === myUid) {
        isScorerRef.current = true;
        setIsScorer(true);
      }
    });
  }

  // Someone else umpires now: this device watches, and says who.
  function handedOff() {
    isScorerRef.current = false;
    setIsScorer(false);
    if (!sessionIdRef.current) return;
    loadSession(sessionIdRef.current)
      .then((sess) => {
        setScorerName(sess.umpireName ?? null);
        if (sess.umpireName) toast(t('umpireIsUmpiringNow', sess.umpireName));
      })
      .catch(() => {});
  }

  // Start: claim the scorer role, then begin with the chosen sides and
  // first server. If another device started it first, watch instead.
  async function handleStart(choice: { teamASide: TeamASide; firstServerId: string }) {
    if (!pendingConfig || starting) return;
    setStarting(true);
    try {
      const started = await startActivity(activityId);
      const scorerUserId = started.scorerUserId ?? null;
      const iAmScorer = scorerUserId != null && scorerUserId === profile?.id;
      isScorerRef.current = iAmScorer;
      setIsScorer(iAmScorer);
      if (iAmScorer) {
        setMatchState(
          createInitialState({ ...pendingConfig, serviceOrderPlayerIds: buildServiceOrder(pendingConfig.players, choice.firstServerId) })
        );
        setTeamASide(choice.teamASide);
      } else {
        setMatchState(createInitialState(pendingConfig));
      }
      watchLive();
      setPendingConfig(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        // Someone else's device started it — watch their scoring.
        const refreshed = await getActivity(activityId).catch(() => null);
        setScorerName(refreshed ? resolveScorerName(refreshed.participants, refreshed.scorerUserId ?? null) : null);
        setIsScorer(false);
        setMatchState(createInitialState(pendingConfig));
        setPendingConfig(null);
        watchLive();
        appAlert(t('matchStartedElsewhere'), undefined, [{ text: t('ok') }]);
      } else {
        appAlert(t('activityLoadError'), undefined, [{ text: t('ok') }]);
      }
    } finally {
      setStarting(false);
    }
  }

  // DP-023: an owner/admin takes the umpire role back for themselves.
  async function handleMakeMeUmpire() {
    if (!session || !profile || reclaiming) return;
    setReclaiming(true);
    try {
      setSession(await setSessionUmpire(session.id, profile.id));
    } catch {
      appAlert(t('umpireChangeFailed'), undefined, [{ text: t('ok') }]);
    } finally {
      setReclaiming(false);
    }
  }

  // Push live state to Firebase — scorer only.
  useEffect(() => {
    if (!isScorer || !matchState) return;
    const payload: LiveMatchPayload = {
      matchState,
      history,
      teamASide,
      updatedAt: Date.now(),
      activityId,
      scorerUid: firebaseUser?.uid,
      confirmed,
    };
    pushLiveMatchState(activityId, payload);
  }, [isScorer, matchState, history, teamASide, confirmed]);

  const teamNames: TeamNames = useMemo(() => {
    if (!matchState) return { A: '', B: '' };
    return {
      A: matchState.config.players.filter((p) => p.team === 'A').map((p) => p.name).join(' / '),
      B: matchState.config.players.filter((p) => p.team === 'B').map((p) => p.name).join(' / '),
    };
  }, [matchState]);

  // DP-025: Confirm result — the only path that completes the match.
  // Until it succeeds the match stays live, with the finished state in the
  // live copy, so a failed save can simply be retried.
  async function handleConfirmResult() {
    if (!isScorer || !matchState?.isEnded || confirming || completedRef.current) return;
    setConfirming(true);
    try {
      await completeActivity(activityId, matchState, history);
      completedRef.current = true;
      setConfirmed(true);
      if (sessionId) {
        const acts = await listActivities(sessionId).catch(() => []);
        setNextQueuedId(acts.find((a) => a.status === 'queued')?.id ?? null);
      }
    } catch (err) {
      console.error('Failed to complete activity', err);
      appAlert(t('confirmResultFailed'), undefined, [{ text: t('ok') }]);
    } finally {
      setConfirming(false);
    }
  }

  function speakScore(prev: MatchState, next: MatchState) {
    const NUM = ['love', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
    const POINT: Record<string, string> = {
      '0': 'love', '15': 'fifteen', '30': 'thirty', '40': 'forty',
      'D': 'deuce', 'SD': 'sudden death', '-': '',
    };
    function numWord(n: number) { return NUM[n] ?? String(n); }

    const setWonByA = next.sets.A > prev.sets.A;
    const setWonByB = next.sets.B > prev.sets.B;
    const gameWonByA = next.games.A > prev.games.A || setWonByA;
    const gameWonByB = next.games.B > prev.games.B || setWonByB;

    cancelSpeech();

    if (gameWonByA || gameWonByB) {
      const winnerName = gameWonByA ? teamNames.A : teamNames.B;
      let intro: string;
      let standing: string;
      const nextServerIsA = getServerTeam(next) === 'A';
      if (setWonByA || setWonByB) {
        const setNum = prev.completedSets.length + 1;
        const ordinal = ORDINAL[setNum] ?? `${setNum}th`;
        intro = `Game and ${ordinal} set, ${winnerName}.`;
        const serverSets = nextServerIsA ? next.sets.A : next.sets.B;
        const receiverSets = nextServerIsA ? next.sets.B : next.sets.A;
        standing = serverSets === receiverSets
          ? `${numWord(serverSets)} set${serverSets === 1 ? '' : 's'} all.`
          : `${numWord(serverSets)} set${serverSets === 1 ? '' : 's'} to ${numWord(receiverSets)}.`;
      } else {
        intro = `Game, ${winnerName}.`;
        const serverGames = nextServerIsA ? next.games.A : next.games.B;
        const receiverGames = nextServerIsA ? next.games.B : next.games.A;
        standing = serverGames === receiverGames
          ? `${numWord(serverGames)} game${serverGames === 1 ? '' : 's'} all.`
          : `${numWord(serverGames)} game${serverGames === 1 ? '' : 's'} to ${numWord(receiverGames)}.`;
      }
      speakTextWithCallback(intro, () => {
        playApplause();
        speakText(standing);
      });
    } else {
      const labelA = getPointLabel(next, 'A');
      const labelB = getPointLabel(next, 'B');
      const serverIsA = getServerTeam(next) === 'A';
      let text: string;
      if (labelA === 'D' || labelA === 'SD') {
        text = POINT[labelA] ?? labelA;
      } else if (labelA === 'AD') {
        text = serverIsA ? 'advantage, server' : 'advantage, receiver';
      } else if (labelB === 'AD') {
        text = serverIsA ? 'advantage, receiver' : 'advantage, server';
      } else if (labelA === labelB) {
        text = labelA === '0' ? 'love all' : `${POINT[labelA] ?? labelA} all`;
      } else {
        const serverLabel = serverIsA ? labelA : labelB;
        const receiverLabel = serverIsA ? labelB : labelA;
        text = `${POINT[serverLabel] ?? serverLabel} ${POINT[receiverLabel] ?? receiverLabel}`;
      }
      if (text) speakText(text);
    }
  }

  function announceFinalResult(ended: MatchState) {
    if (ended.sets.A === 0 && ended.sets.B === 0 && ended.games.A === 0 && ended.games.B === 0) return;
    cancelSpeech();
    const hasSets = ended.sets.A > 0 || ended.sets.B > 0;
    const winnerName = ended.winner === 'A' ? teamNames.A : ended.winner === 'B' ? teamNames.B : null;
    const scoreText = hasSets ? `${ended.sets.A} sets to ${ended.sets.B}` : `${ended.games.A} games to ${ended.games.B}`;
    const announcement = winnerName ? `Match over. ${winnerName} wins, ${scoreText}.` : `Match over. Final score, ${scoreText}.`;
    playApplause();
    speakText(announcement);
  }

  function handleAddPoint(team: Team) {
    if (!isScorer || !matchState || matchState.isEnded) return;
    initAudio();
    const next = addPoint(matchState, team);
    const prev = matchState;
    const nextHistory = [...history, cloneState(prev)];
    setHistory(nextHistory);
    setMatchState(next);
    if (!next.isEnded && voiceEnabled) speakScore(prev, next);
    // The match ends on the court; the umpire confirms it on Match
    // finished (DP-025).
    if (next.isEnded) announceFinalResult(next);
  }

  function handleUndo() {
    if (!isScorer || !history.length || !matchState) return;
    cancelSpeech();
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setMatchState(previous);
  }

  function handleEndMatch() {
    if (!isScorer || !matchState || matchState.isEnded) return;
    const ended = endMatchNow(matchState);
    const nextHistory = [...history, cloneState(matchState)];
    setHistory(nextHistory);
    setMatchState(ended);
    announceFinalResult(ended);
  }

  function handleShare() {
    if (!matchState) return;
    setNativeShareData(buildMatchShareData(matchState, teamNames));
  }

  // Leaving a confirmed match. Its result is saved on the server, so the
  // scorer clears the live copy spectators were following.
  function handleBackToSession() {
    if (isScorer) deleteLiveMatch(activityId);
    if (sessionId) onBackToSession(sessionId);
    else onDone();
  }

  function handleSetUpNextMatch() {
    if (!nextQueuedId) return;
    if (isScorer) deleteLiveMatch(activityId);
    onOpenMatch(nextQueuedId);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-ink-muted dark:text-ink-muted-dark">{t('activityLoading')}</Text>
      </SafeAreaView>
    );
  }

  if (pendingConfig) {
    const umpireIsMe = session?.umpireUserId === profile?.id;
    return (
      <>
        <MatchStartScreen
          players={pendingConfig.players}
          starting={starting}
          umpire={session ? { name: session.umpireName ?? '', isMe: umpireIsMe } : undefined}
          onChangeUmpire={isOrganizer ? () => setUmpireSheetVisible(true) : undefined}
          onMakeMeUmpire={isOrganizer && !umpireIsMe ? handleMakeMeUmpire : undefined}
          reclaiming={reclaiming}
          onBack={onDone}
          onStart={handleStart}
        />
        {session && profile && isOrganizer && (
          <UmpireSheet
            visible={umpireSheetVisible}
            session={session}
            myUserId={profile.id}
            myName={profile.displayName || profile.username}
            onClose={() => setUmpireSheetVisible(false)}
            onChanged={setSession}
          />
        )}
      </>
    );
  }

  if (error || !matchState) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark items-center justify-center px-6">
        <Text className="text-red-500 text-center mb-4">{error ?? t('activityLoadError')}</Text>
        <Button onPress={onDone}><ButtonText>{t('back')}</ButtonText></Button>
      </SafeAreaView>
    );
  }

  // Ended on the court, not confirmed yet (DP-025): the umpire confirms or
  // undoes the last point; everyone else waits on the final score.
  if (matchState.isEnded && !confirmed) {
    return (
      <MatchFinishedScreen
        matchState={matchState}
        teamNames={teamNames}
        onBack={onDone}
        scorer={isScorer ? { confirming, onConfirm: handleConfirmResult, onUndo: handleUndo } : undefined}
      />
    );
  }

  if (matchState.isEnded) {
    return (
      <>
        {isScorer && !openedFinished ? (
          // Just confirmed here (DP-025).
          <ResultSavedScreen
            matchState={matchState}
            teamNames={teamNames}
            onShare={handleShare}
            onSetUpNextMatch={nextQueuedId ? handleSetUpNextMatch : undefined}
            onBackToSession={handleBackToSession}
          />
        ) : (
          // A finished match opened later, or watched to the end: its
          // result with Share (DP-026).
          <MatchResultScreen matchState={matchState} teamNames={teamNames} onShare={handleShare} onBack={onDone} />
        )}
        <NativeShareModal data={nativeShareData} onClose={() => setNativeShareData(null)} />
      </>
    );
  }

  return (
    <View className="flex-1">
      <MobileMatchScreen
        matchState={matchState}
        teamNames={teamNames}
        teamASide={teamASide}
        history={history}
        hasUndo={history.length > 0 && (
          matchState.points.A > 0 ||
          matchState.points.B > 0 ||
          matchState.tiebreak != null ||
          matchState.games.A + matchState.games.B > 0
        )}
        voiceEnabled={voiceEnabled}
        readOnly={!isScorer}
        scorerName={scorerName}
        onAddPoint={handleAddPoint}
        onUndo={handleUndo}
        onEndMatch={handleEndMatch}
        onToggleVoice={() => setVoiceEnabled((v) => !v)}
        onOpenOptions={isScorer && !isOrganizer ? () => setOptionsVisible(true) : undefined}
      />
      <MatchOptionsSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        askOrganizers={isOrganizer ? undefined : organizers.map((m) => m.displayName || m.username)}
      />
    </View>
  );
}
