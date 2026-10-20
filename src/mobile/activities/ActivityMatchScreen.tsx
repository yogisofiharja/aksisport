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
import type { ActivityParticipant } from '../../core/api/types';
import { getActivity, startActivity, completeActivity } from '../../core/activities/api';
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
import { MatchStartScreen } from './MatchStartScreen';
import { buildServiceOrder } from '../../core/activities/buildGeneratedMatchPayload';
import { appAlert } from '../../design-system/feedback/appAlert';
import { NativeShareModal } from '../../components/NativeShareModal';
import type { NativeShareData } from '../../components/NativeShareModal';
import { useTranslation } from '../../i18n';

type Props = {
  activityId: string;
  onDone: () => void;
  // After a finished match: back to its Session's matches, to pick the
  // next one.
  onNextMatch: (sessionId: string) => void;
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

export function ActivityMatchScreen({ activityId, onDone, onNextMatch }: Props) {
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
  // Opened after it finished (from the Matches list): a back arrow on the
  // result, not "Next match".
  const [openedFinished, setOpenedFinished] = useState(false);
  // DP-022: a match that hasn't started opens on the start screen (sides,
  // first server); its stored config waits here until Start.
  const [pendingConfig, setPendingConfig] = useState<MatchConfig | null>(null);
  const [starting, setStarting] = useState(false);
  const [teamASide, setTeamASide] = useState<TeamASide>('left');

  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const unsubscribeLiveRef = useRef<(() => void) | null>(null);

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
        const config = detail.config as MatchConfig;

        // Already finished before this device ever opened it — render the
        // stored result directly. Never rely on RTDB for a completed match;
        // the live node may already be gone (see cleanup notes below).
        if (detail.status === 'completed') {
          completedRef.current = true;
          setOpenedFinished(true);
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
        setIsScorer(iAmScorer);
        setScorerName(resolveScorerName(detail.participants, scorerUserId));

        if (iAmScorer) {
          // Reopening a match in progress: carry on from the live copy
          // rather than restarting at 0–0 (and overwriting it).
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
          watchAsSpectator();
        }
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

  function watchAsSpectator() {
    if (!isFirebaseReady) {
      setError(t('activityLiveUnavailable'));
      return;
    }
    unsubscribeLiveRef.current?.();
    unsubscribeLiveRef.current = subscribeToLiveMatch(activityId, (payload) => {
      if (!payload) return; // no live data yet/anymore — keep last-known local state
      if (payload.matchState) setMatchState(payload.matchState);
      if (payload.history) setHistory(payload.history);
      setTeamASide(normalizeSide(payload.teamASide));
    });
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
      setIsScorer(iAmScorer);
      if (iAmScorer) {
        setMatchState(
          createInitialState({ ...pendingConfig, serviceOrderPlayerIds: buildServiceOrder(pendingConfig.players, choice.firstServerId) })
        );
        setTeamASide(choice.teamASide);
      } else {
        setMatchState(createInitialState(pendingConfig));
        watchAsSpectator();
      }
      setPendingConfig(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        // Someone else's device started it — watch their scoring.
        const refreshed = await getActivity(activityId).catch(() => null);
        setScorerName(refreshed ? resolveScorerName(refreshed.participants, refreshed.scorerUserId ?? null) : null);
        setIsScorer(false);
        setMatchState(createInitialState(pendingConfig));
        setPendingConfig(null);
        watchAsSpectator();
        appAlert(t('matchStartedElsewhere'), undefined, [{ text: t('ok') }]);
      } else {
        appAlert(t('activityLoadError'), undefined, [{ text: t('ok') }]);
      }
    } finally {
      setStarting(false);
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
    };
    pushLiveMatchState(activityId, payload);
  }, [isScorer, matchState, history, teamASide]);

  const teamNames: TeamNames = useMemo(() => {
    if (!matchState) return { A: '', B: '' };
    return {
      A: matchState.config.players.filter((p) => p.team === 'A').map((p) => p.name).join(' / '),
      B: matchState.config.players.filter((p) => p.team === 'B').map((p) => p.name).join(' / '),
    };
  }, [matchState]);

  async function finalizeActivity(ended: MatchState, log: MatchState[]) {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      await completeActivity(activityId, ended, log);
    } catch (err) {
      console.error('Failed to complete activity', err);
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
    if (next.isEnded) {
      announceFinalResult(next);
      finalizeActivity(next, nextHistory);
    }
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
    finalizeActivity(ended, nextHistory);
  }

  function handleShare() {
    if (!matchState) return;
    const hasSets = matchState.sets.A > 0 || matchState.sets.B > 0;
    const mainScore = hasSets ? `${matchState.sets.A} - ${matchState.sets.B}` : `${matchState.games.A} - ${matchState.games.B}`;
    const breakdown = hasSets ? matchState.completedSets.map((s) => `${s.A}–${s.B}`).join('  ·  ') : undefined;
    const winnerName = matchState.winner === 'A' ? teamNames.A : matchState.winner === 'B' ? teamNames.B : undefined;
    setNativeShareData({
      matchup: `${teamNames.A} vs ${teamNames.B}`,
      score: mainScore,
      breakdown,
      message: [
        '🎾 Aksi',
        `${teamNames.A} vs ${teamNames.B}`,
        mainScore,
        breakdown ?? '',
        winnerName ? `${winnerName} menang` : '',
      ].filter(Boolean).join('\n'),
      winnerName,
    });
  }

  // Leaving a finished match for the next one. Its result is saved on the
  // server, so the scorer clears the live copy spectators were following.
  function handleNextMatch() {
    if (isScorer) deleteLiveMatch(activityId);
    if (sessionId) onNextMatch(sessionId);
    else onDone();
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
    return <MatchStartScreen players={pendingConfig.players} starting={starting} onBack={onDone} onStart={handleStart} />;
  }

  if (error || !matchState) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark items-center justify-center px-6">
        <Text className="text-red-500 text-center mb-4">{error ?? t('activityLoadError')}</Text>
        <Button onPress={onDone}><ButtonText>{t('back')}</ButtonText></Button>
      </SafeAreaView>
    );
  }

  if (matchState.isEnded) {
    return (
      <>
        <MatchResultScreen
          matchState={matchState}
          teamNames={teamNames}
          onShare={handleShare}
          onNextMatch={openedFinished ? undefined : handleNextMatch}
          onBack={openedFinished ? onDone : undefined}
        />
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
      />
    </View>
  );
}
