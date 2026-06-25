import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import {
  addPoint,
  createInitialState,
  endMatchNow,
  getPointLabel,
  MatchConfig,
  MatchState,
  Player,
  Team,
} from './src/scoring';
import {
  composeShareCardDataUrlWeb,
  downloadDataUrlWeb,
  pickImageDataUrlWeb,
  shareImageWeb,
} from './src/shareCard';
import { LineupResult, MatchRecord, PersistedAppState, SetupForm, TeamASide } from './src/appTypes';
import { FinalScoreScreen } from './src/components/FinalScoreScreen';
import { HistoryScreen } from './src/components/HistoryScreen';
import { LineupScreen } from './src/components/LineupScreen';
import { MatchSetup } from './src/components/MatchSetup';
import { MatchScreen } from './src/components/MatchScreen';
import {
  clearPersistedStateFromStorage,
  loadPersistedStateFromStorage,
  savePersistedStateToStorage,
  STORAGE_KEY,
} from './src/persistence';
import {
  deleteSession,
  generateSessionCode,
  pushSessionState,
  SessionPayload,
  subscribeToSession,
} from './src/sessionSync';
import { isFirebaseReady } from './src/firebase';

type AppScreen = 'setup' | 'lineup' | 'match' | 'final' | 'history';

const INITIAL_SETUP: SetupForm = {
  mode: 'single',
  singleDeuceSuddenDeath: true,
  players: [],
};

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [setup, setSetup] = useState<SetupForm>(INITIAL_SETUP);
  const [teamASide, setTeamASide] = useState<TeamASide>('left');
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [history, setHistory] = useState<MatchState[]>([]);
  const [backgroundPhotoDataUrl, setBackgroundPhotoDataUrl] = useState<string | null>(null);
  const [sharePreviewDataUrl, setSharePreviewDataUrl] = useState<string | null>(null);
  const [sharePreviewText, setSharePreviewText] = useState('');
  const [playerPlayCounts, setPlayerPlayCounts] = useState<Record<string, number>>({});
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Audio: fetch starts on mount; AudioContext created on first user gesture (gesture-unlock required)
  const rawBufferPromiseRef = useRef<Promise<ArrayBuffer | null> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const applauseBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    rawBufferPromiseRef.current = fetch('/sounds/applause.mp3')
      .then((r) => r.arrayBuffer())
      .catch(() => null);
  }, []);

  function initAudio() {
    if (typeof window === 'undefined') return;
    if (audioCtxRef.current) return;
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx() as AudioContext;
    audioCtxRef.current = ctx;
    const pending = rawBufferPromiseRef.current
      ?? fetch('/sounds/applause.mp3').then((r) => r.arrayBuffer()).catch(() => null);
    pending
      .then((buf) => {
        if (!buf) return;
        ctx.decodeAudioData(
          buf,
          (decoded) => { applauseBufferRef.current = decoded; },
          () => {}
        );
      })
      .catch(() => {});
  }

  // Refs for use inside async callbacks / closures where state would be stale
  const sessionCodeRef = useRef<string | null>(null);
  const lastPushTimeRef = useRef<number>(0);
  const lastRemoteUpdateRef = useRef<number>(0);
  const unsubscribeSessionRef = useRef<(() => void) | null>(null);
  const historyReturnScreenRef = useRef<AppScreen>('setup');

  // ── Persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    const restored = loadPersistedState();
    if (!restored) return;

    setSetup(restored.setup);
    setTeamASide(restored.teamASide ?? 'left');
    setMatchState(restored.matchState);
    setHistory(restored.history);
    setBackgroundPhotoDataUrl(restored.backgroundPhotoDataUrl ?? null);
    setPlayerPlayCounts(restored.playerPlayCounts ?? {});
    setMatchHistory(restored.matchHistory ?? []);

    if (restored.matchState) {
      setScreen(restored.matchState.isEnded ? 'final' : 'match');
    }

    if (restored.sessionCode && isFirebaseReady) {
      sessionCodeRef.current = restored.sessionCode;
      setSessionCode(restored.sessionCode);
      startSessionSubscription(restored.sessionCode);
    }
  }, []);

  useEffect(() => {
    savePersistedState({ version: 1, setup, teamASide, matchState, history, backgroundPhotoDataUrl, playerPlayCounts, matchHistory, sessionCode });
  }, [setup, teamASide, matchState, history, backgroundPhotoDataUrl, playerPlayCounts, matchHistory, sessionCode]);

  // ── Firebase session sync — push all state on any change ─────────────────
  useEffect(() => {
    const code = sessionCodeRef.current;
    if (!code) return;
    // Skip if this render was caused by a remote update (prevent echo)
    if (Date.now() - lastRemoteUpdateRef.current < 400) return;
    const now = Date.now();
    lastPushTimeRef.current = now;
    pushSessionState(code, {
      setup, matchState, history, teamASide, playerPlayCounts, updatedAt: now,
    });
  }, [setup, matchState, history, teamASide, playerPlayCounts]);

  // ── Session join via URL param ─────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('code');
    if (joinCode) joinExistingSession(joinCode.toUpperCase());
  }, []);

  // ── Session sync helpers ──────────────────────────────────────────────────

  function applyRemotePayload(payload: SessionPayload) {
    // Ignore our own echoes
    if (Math.abs(payload.updatedAt - lastPushTimeRef.current) < 1000) return;
    lastRemoteUpdateRef.current = Date.now();
    setSetup(payload.setup ?? INITIAL_SETUP);
    setMatchState(payload.matchState ?? null);
    setHistory(payload.history ?? []);
    setTeamASide(payload.teamASide ?? 'left');
    setPlayerPlayCounts(payload.playerPlayCounts ?? {});
    // Navigate based on match state so each device can independently move through
    // setup/lineup, but both land on match/final when a match is active or over.
    if (payload.matchState?.isEnded) {
      setScreen('final');
    } else if (payload.matchState) {
      setScreen('match');
    }
    // No matchState → stay on the device's current screen (setup or lineup)
  }

  function startSessionSubscription(code: string) {
    if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
    const unsub = subscribeToSession(code, (payload: SessionPayload | null) => {
      if (payload) applyRemotePayload(payload);
    });
    unsubscribeSessionRef.current = unsub;
  }

  function joinExistingSession(code: string) {
    if (!isFirebaseReady) return;
    sessionCodeRef.current = code;
    setSessionCode(code);
    startSessionSubscription(code);
  }

  function endSession() {
    if (unsubscribeSessionRef.current) {
      unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = null;
    }
    if (sessionCodeRef.current) {
      deleteSession(sessionCodeRef.current);
      sessionCodeRef.current = null;
    }
    setSessionCode(null);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const teamNames = useMemo(() => {
    if (!matchState) return { A: 'Tim A', B: 'Tim B' };
    const a = matchState.config.players
      .filter((p) => p.team === 'A')
      .map((p) => p.name)
      .join(' / ');
    const b = matchState.config.players
      .filter((p) => p.team === 'B')
      .map((p) => p.name)
      .join(' / ');
    return { A: a, B: b };
  }, [matchState]);

  // ── Setup screen ──────────────────────────────────────────────────────────

  function handleUpdateSetup(updates: Partial<SetupForm>) {
    setSetup((prev) => ({ ...prev, ...updates }));
  }

  function handleCreateSession() {
    if (!sessionCodeRef.current && isFirebaseReady) {
      const code = generateSessionCode();
      sessionCodeRef.current = code;
      setSessionCode(code);
      startSessionSubscription(code);
    }
  }

  function handleGoToLineup() {
    const requiredPlayers = setup.mode === 'double' ? 4 : 2;
    if (setup.players.length < requiredPlayers) {
      showMessage(`Butuh minimal ${requiredPlayers} pemain untuk mode ${setup.mode}.`);
      return;
    }
    // Generate session code now (first time only) so joiner can scan at match screen
    if (!sessionCodeRef.current && isFirebaseReady) {
      const code = generateSessionCode();
      sessionCodeRef.current = code;
      setSessionCode(code);
      startSessionSubscription(code);
    }
    setScreen('lineup');
  }

  function handleJoinSession(code: string) {
    if (!code) return;
    joinExistingSession(code);
  }

  // ── Lineup screen ─────────────────────────────────────────────────────────

  function handleLineupConfirm(lineup: LineupResult) {
    // Ensure a session code exists — may have been cleared between matches
    if (!sessionCodeRef.current && isFirebaseReady) {
      const code = generateSessionCode();
      sessionCodeRef.current = code;
      setSessionCode(code);
      startSessionSubscription(code);
    }

    const players = buildPlayers(lineup.teamANames, lineup.teamBNames);
    const firstServerPlayer = players.find((p) => p.name === lineup.firstServerName);
    const firstServerId = firstServerPlayer?.id ?? players[0].id;

    const config: MatchConfig = {
      mode: setup.mode,
      deuceMode: setup.singleDeuceSuddenDeath ? 'singleDeuceSuddenDeath' : 'standard',
      players,
      serviceOrderPlayerIds: buildServiceOrder(players, firstServerId),
    };

    const initialState = createInitialState(config);
    const side = lineup.teamASide;

    setTeamASide(side);
    setMatchState(initialState);
    setHistory([]);
    setBackgroundPhotoDataUrl(null);
    setSharePreviewDataUrl(null);
    setScreen('match');
  }

  // ── Match screen ──────────────────────────────────────────────────────────

  function playApplause(): Promise<void> {
    return new Promise((resolve) => {
      const ctx = audioCtxRef.current;
      const buffer = applauseBufferRef.current;
      if (!ctx || !buffer) { resolve(); return; }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.85, ctx.currentTime);
      gain.connect(ctx.destination);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => resolve();

      (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve())
        .then(() => source.start())
        .catch(() => resolve());
    });
  }

  function pickVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter((v) => v.lang.startsWith('en'));
    // Prefer natural/neural voices in priority order
    const PREFERRED = ['Samantha', 'Alex', 'Karen', 'Daniel', 'Google US English', 'Google UK English Female'];
    for (const name of PREFERRED) {
      const match = enVoices.find((v) => v.name === name);
      if (match) return match;
    }
    // Fall back to any Google voice, then any English voice
    return enVoices.find((v) => v.name.includes('Google')) ?? enVoices[0] ?? null;
  }

  function speakScore(prev: MatchState, next: MatchState) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const NUM = ['love', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
    const POINT: Record<string, string> = {
      '0': 'love', '15': 'fifteen', '30': 'thirty', '40': 'forty',
      'D': 'deuce', 'SD': 'sudden death', '-': '',
    };

    function numWord(n: number) { return NUM[n] ?? String(n); }
    function gameScore(winnerScore: number, loserScore: number, unit: string) {
      if (winnerScore === loserScore) return `${numWord(winnerScore)} ${unit}s all`;
      return `leads, ${numWord(winnerScore)} ${unit}${winnerScore === 1 ? '' : 's'} to ${numWord(loserScore)}`;
    }

    const setWonByA = next.sets.A > prev.sets.A;
    const setWonByB = next.sets.B > prev.sets.B;
    const gameWonByA = next.games.A > prev.games.A || setWonByA;
    const gameWonByB = next.games.B > prev.games.B || setWonByB;

    function speak(text: string) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'en-US';
      utt.rate = 1.0;
      utt.pitch = 1.0;
      const voice = pickVoice();
      if (voice) utt.voice = voice;
      window.speechSynthesis.speak(utt);
    }

    window.speechSynthesis.cancel();

    if (gameWonByA || gameWonByB) {
      const winnerName = gameWonByA ? teamNames.A : teamNames.B;
      let intro: string;
      let standing: string;
      // After a game, currentServerPlayerId is already rotated to the next server.
      // Wimbledon protocol: next server's score first, no "leads", just numbers.
      const nextServerIsA = next.currentServerPlayerId.startsWith('A');
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
      // Sequence: speak intro → applause → speak standing
      const uttIntro = new SpeechSynthesisUtterance(intro);
      uttIntro.lang = 'en-US';
      uttIntro.rate = 1.0;
      const voice = pickVoice();
      if (voice) uttIntro.voice = voice;
      uttIntro.onend = () => {
        playApplause();
        speak(standing);
      };
      window.speechSynthesis.speak(uttIntro);
    } else {
      const labelA = getPointLabel(next, 'A');
      const labelB = getPointLabel(next, 'B');
      const serverIsA = next.currentServerPlayerId.startsWith('A');
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
      if (text) speak(text);
    }
  }

  function handleAddPoint(team: Team) {
    if (!matchState || matchState.isEnded) return;
    initAudio();
    const next = addPoint(matchState, team);
    const prev = matchState;
    setHistory((h) => [...h, cloneState(prev)]);
    setMatchState(next);
    if (!next.isEnded && voiceEnabled) speakScore(prev, next);
    if (next.isEnded) {
      incrementPlayCounts();
      addToMatchHistory(next);
      setScreen('final');
      const code = sessionCodeRef.current;
      if (code) setTimeout(() => deleteSession(code), 2000);
    }
  }

  function handleUndo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setMatchState(previous);
    if (!previous.isEnded) setScreen('match');
  }

  function handleEndMatch() {
    if (!matchState || matchState.isEnded) return;
    const ended = endMatchNow(matchState);
    setHistory((prev) => [...prev, cloneState(matchState)]);
    setMatchState(ended);
    incrementPlayCounts();
    addToMatchHistory(ended);
    setScreen('final');
    const code = sessionCodeRef.current;
    if (code) setTimeout(() => deleteSession(code), 2000);
  }

  function incrementPlayCounts() {
    if (!matchState) return;
    setPlayerPlayCounts((prev) => {
      const updated = { ...prev };
      matchState.config.players.forEach((player) => {
        updated[player.name] = (updated[player.name] ?? 0) + 1;
      });
      return updated;
    });
  }

  function addToMatchHistory(state: MatchState) {
    const record: MatchRecord = {
      id: Date.now().toString(),
      completedAt: Date.now(),
      teams: {
        A: state.config.players.filter((p) => p.team === 'A').map((p) => p.name),
        B: state.config.players.filter((p) => p.team === 'B').map((p) => p.name),
      },
      games: state.games,
      sets: state.sets,
      completedSets: state.completedSets,
      winner: state.winner,
      mode: state.config.mode,
    };
    setMatchHistory((prev) => [record, ...prev].slice(0, 100));
  }

  // ── Final / share ─────────────────────────────────────────────────────────

  async function handleShare() {
    if (!matchState) return;

    const winnerText =
      matchState.winner === 'A'
        ? `${teamNames.A} menang`
        : matchState.winner === 'B'
          ? `${teamNames.B} menang`
          : '';

    const hasSets = matchState.sets.A > 0 || matchState.sets.B > 0;
    const mainScore = hasSets
      ? `${matchState.sets.A} - ${matchState.sets.B}`
      : `${matchState.games.A} - ${matchState.games.B}`;
    const setBreakdown = hasSets
      ? matchState.completedSets.map(s => `${s.A}–${s.B}`).join('  ·  ')
      : undefined;

    const shareText = [
      `${teamNames.A} vs ${teamNames.B}`,
      hasSets ? `Set: ${matchState.sets.A} - ${matchState.sets.B}` : `Game: ${matchState.games.A} - ${matchState.games.B}`,
      hasSets ? `Game: ${matchState.games.A} - ${matchState.games.B}` : null,
      `Poin: ${getPointLabel(matchState, 'A')} - ${getPointLabel(matchState, 'B')}`,
      winnerText,
    ].filter((line): line is string => Boolean(line?.trim())).join('\n');

    if (Platform.OS === 'web') {
      try {
        setBackgroundPhotoDataUrl(null);
        const cardDataUrl = await composeShareCardDataUrlWeb({
          backgroundDataUrl: undefined,
          title: '',
          matchup: `${teamNames.A} vs ${teamNames.B}`,
          gameScore: mainScore,
          setBreakdown,
        });
        setSharePreviewDataUrl(cardDataUrl);
        setSharePreviewText(shareText);
      } catch (err) {
        console.error('Failed to generate share card', err);
      }
      return;
    }

    try {
      await Share.share({ message: shareText });
    } catch {
      // share cancelled or unavailable, no feedback needed
    }
  }

  async function handleShareFromPreview() {
    if (!sharePreviewDataUrl) return;
    const imageShared = await shareImageWeb(sharePreviewDataUrl, sharePreviewText);
    if (imageShared) {
      setSharePreviewDataUrl(null);
      return;
    }
    downloadDataUrlWeb(sharePreviewDataUrl, 'poinyuk-score.png');
  }

  function closeSharePreview() {
    setSharePreviewDataUrl(null);
  }

  async function handleChangeBackground(source: 'gallery' | 'camera') {
    if (Platform.OS !== 'web') return;
    const dataUrl = await pickImageDataUrlWeb(source);
    if (!dataUrl) return;
    setBackgroundPhotoDataUrl(dataUrl);
    if (!matchState) return;
    const hasSetsChange = matchState.sets.A > 0 || matchState.sets.B > 0;
    try {
      const cardDataUrl = await composeShareCardDataUrlWeb({
        backgroundDataUrl: dataUrl,
        title: '',
        matchup: `${teamNames.A} vs ${teamNames.B}`,
        gameScore: hasSetsChange
          ? `${matchState.sets.A} - ${matchState.sets.B}`
          : `${matchState.games.A} - ${matchState.games.B}`,
        setBreakdown: hasSetsChange
          ? matchState.completedSets.map(s => `${s.A}–${s.B}`).join('  ·  ')
          : undefined,
      });
      setSharePreviewDataUrl(cardDataUrl);
    } catch (err) {
      console.error('Failed to process background photo', err);
    }
  }

  function handleBackToSetup() {
    // Keep session alive and matchState (isEnded) so lineup "Kembali" returns to final
    setHistory([]);
    setSharePreviewDataUrl(null);
    setScreen('lineup');
  }

  function handleClearSavedState() {
    endSession();
    clearPersistedState();
    setSetup(INITIAL_SETUP);
    setTeamASide('left');
    setMatchState(null);
    setHistory([]);
    setMatchHistory([]);
    setPlayerPlayCounts({});
    setBackgroundPhotoDataUrl(null);
    setSharePreviewDataUrl(null);
    setScreen('setup');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (screen === 'history') {
    return (
      <HistoryScreen
        matchHistory={matchHistory}
        sessionCode={sessionCode}
        onBack={() => setScreen(historyReturnScreenRef.current)}
      />
    );
  }

  if (screen === 'lineup') {
    return (
      <LineupScreen
        players={setup.players}
        mode={setup.mode}
        playerPlayCounts={playerPlayCounts}
        sessionCode={sessionCode}
        onConfirm={handleLineupConfirm}
        onBack={() => {
          if (matchState && !matchState.isEnded) {
            setScreen('match');
          } else if (matchState?.isEnded) {
            setScreen('final');
          } else {
            setScreen('setup');
          }
        }}
      />
    );
  }

  if (screen === 'match' && matchState && !matchState.isEnded) {
    return (
      <MatchScreen
        matchState={matchState}
        teamNames={teamNames}
        teamASide={teamASide}
        hasUndo={history.length > 0}
        sessionCode={sessionCode}
        voiceEnabled={voiceEnabled}
        onAddPoint={handleAddPoint}
        onUndo={handleUndo}
        onEndMatch={handleEndMatch}
        onToggleVoice={() => setVoiceEnabled((v) => !v)}
      />
    );
  }

  if (screen === 'final' && matchState?.isEnded) {
    return (
      <FinalScoreScreen
        matchState={matchState}
        teamNames={teamNames}
        sharePreviewDataUrl={sharePreviewDataUrl}
        sessionCode={sessionCode}
        onShare={handleShare}
        onShareFromPreview={handleShareFromPreview}
        onCloseSharePreview={closeSharePreview}
        onChangeBackground={handleChangeBackground}
        onBackToSetup={handleBackToSetup}
        onClearSavedState={handleClearSavedState}
        onShowHistory={() => { historyReturnScreenRef.current = 'final'; setScreen('history'); }}
      />
    );
  }

  // Default: setup screen
  return (
    <MatchSetup
      setup={setup}
      sessionCode={sessionCode}
      onUpdateSetup={handleUpdateSetup}
      onStartMatch={handleGoToLineup}
      onJoinSession={handleJoinSession}
      onCreateSession={handleCreateSession}
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPlayers(teamANames: string[], teamBNames: string[]): Player[] {
  return [
    ...teamANames.map((name, i) => ({ id: `A${i + 1}`, name, team: 'A' as const })),
    ...teamBNames.map((name, i) => ({ id: `B${i + 1}`, name, team: 'B' as const })),
  ];
}

function buildServiceOrder(players: Player[], firstServerId: string): string[] {
  const teamA = players.filter((p) => p.team === 'A');
  const teamB = players.filter((p) => p.team === 'B');
  const base: string[] = [];
  const maxCount = Math.max(teamA.length, teamB.length);
  for (let i = 0; i < maxCount; i++) {
    if (teamA[i]) base.push(teamA[i].id);
    if (teamB[i]) base.push(teamB[i].id);
  }
  const startIdx = base.indexOf(firstServerId);
  if (startIdx < 0) return base;
  return [...base.slice(startIdx), ...base.slice(0, startIdx)];
}

function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState;
}

function showMessage(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
    return;
  }
  Alert.alert('PoinYuk', message);
}

function loadPersistedState(): PersistedAppState | null {
  if (Platform.OS !== 'web') return null;
  return loadPersistedStateFromStorage(window.localStorage, STORAGE_KEY);
}

function savePersistedState(state: PersistedAppState) {
  if (Platform.OS !== 'web') return;
  savePersistedStateToStorage(window.localStorage, state, STORAGE_KEY);
}

function clearPersistedState() {
  if (Platform.OS !== 'web') return;
  clearPersistedStateFromStorage(window.localStorage, STORAGE_KEY);
}
