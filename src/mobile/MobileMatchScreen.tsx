import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { TeamNames, TeamASide } from '../appTypes';
import { getPointLabel, getServerTeam, MatchState, Team } from '../sports/tennis/scoringEngine';
import { storageGet, storageSave } from '../storage';
import { useTranslation } from '../i18n';

const HOLD_MS = 700;
const FOCUS_KEY = 'aksi.scoringFocusMode';

// Focus mode needs landscape. The phone apps can turn the screen; a
// browser only can where it supports going full screen *and* locking the
// orientation on a touch device — in practice Android browsers. iPhone
// browsers support neither, and computers are landscape already, so the
// button isn't offered there.
const WEB_FOCUS_SUPPORTED =
  Platform.OS === 'web' &&
  typeof document !== 'undefined' &&
  typeof document.documentElement?.requestFullscreen === 'function' &&
  typeof (screen as Screen & { orientation?: { lock?: unknown } }).orientation?.lock === 'function' &&
  (navigator.maxTouchPoints ?? 0) > 0;
const FOCUS_SUPPORTED = Platform.OS !== 'web' || WEB_FOCUS_SUPPORTED;

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  teamASide: TeamASide;
  history: MatchState[];
  hasUndo: boolean;
  voiceEnabled: boolean;
  /** Viewer mode: no scoring, undo, or end-match controls. */
  readOnly?: boolean;
  /** Shown in the LIVE badge when readOnly. */
  scorerName?: string | null;
  onAddPoint: (team: Team) => void;
  onUndo: () => void;
  onEndMatch: () => void;
  onToggleVoice: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScorer(prev: MatchState, cur: MatchState): Team | null {
  if (cur.sets.A > prev.sets.A) return 'A';
  if (cur.sets.B > prev.sets.B) return 'B';
  if (cur.games.A > prev.games.A) return 'A';
  if (cur.games.B > prev.games.B) return 'B';
  if (cur.points.A > prev.points.A) return 'A';
  if (cur.points.B > prev.points.B) return 'B';
  return null;
}

type LogEntry = {
  scorer: Team;
  kind: 'point' | 'game' | 'set';
  pointA: string;
  pointB: string;
  gameA: number;
  gameB: number;
  setA: number;
  setB: number;
};

function buildLog(history: MatchState[], current: MatchState): LogEntry[] {
  const states = [...history, current];
  const entries: LogEntry[] = [];
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1];
    const cur = states[i];
    const scorer = getScorer(prev, cur);
    if (!scorer) continue;
    const setChanged = cur.sets.A + cur.sets.B > prev.sets.A + prev.sets.B;
    const gameChanged = cur.games.A + cur.games.B > prev.games.A + prev.games.B ||
      (prev.tiebreak != null && cur.tiebreak == null);
    entries.push({
      scorer,
      kind: setChanged ? 'set' : gameChanged ? 'game' : 'point',
      pointA: getPointLabel(cur, 'A'),
      pointB: getPointLabel(cur, 'B'),
      gameA: cur.games.A,
      gameB: cur.games.B,
      setA: cur.sets.A,
      setB: cur.sets.B,
    });
  }
  return entries.reverse();
}

// ── Component ─────────────────────────────────────────────────────────────────

// The live scoreboard (DP-022) in two modes:
// - normal: portrait, in the app's own look (like the match start screen) —
//   a score summary, the two teams side by side as big tappable cards, and
//   the controls below;
// - focus: landscape, the full-screen court — each half a giant tap target.
// The choice is remembered on the device. Both modes share the controls
// (undo, voice, point log, hold-to-end) and their dialogs.
export function MobileMatchScreen({
  matchState,
  teamNames,
  teamASide,
  history,
  hasUndo,
  voiceEnabled,
  readOnly = false,
  scorerName,
  onAddPoint,
  onUndo,
  onEndMatch,
  onToggleVoice,
}: Props) {
  const [focus, setFocus] = useState(false);
  const [showPointLog, setShowPointLog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showHoldHint, setShowHoldHint] = useState(false);
  const [scoreBoxHalfW, setScoreBoxHalfW] = useState(0);
  // Normal mode sizes the scores from the team row's real size (the app
  // can be narrower than the window, e.g. the phone-width column on web).
  const [teamRow, setTeamRow] = useState({ width: 0, height: 0 });
  const [court, setCourt] = useState({ width: 0, height: 0 });

  const pressAnim = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    // On the phone apps, reopen in the mode last used. A browser can only
    // go full screen from a tap, so web always opens in normal mode.
    if (Platform.OS !== 'web') {
      storageGet(FOCUS_KEY)
        .then((v) => v === '1' && setFocus(true))
        .catch(() => {});
    }
    // Left full screen with the browser's own gesture: back to normal.
    const onFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) setFocus(false);
    };
    if (WEB_FOCUS_SUPPORTED) document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      if (WEB_FOCUS_SUPPORTED) {
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        leaveWebFullscreen();
      }
      if (Platform.OS !== 'web') ScreenOrientation.unlockAsync().catch(() => {});
      holdAnim.current?.stop();
      if (hintTimeout.current) clearTimeout(hintTimeout.current);
    };
  }, []);

  // Phone apps turn with the mode: landscape for focus, portrait otherwise.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenOrientation.lockAsync(
      focus ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
    ).catch(() => {});
  }, [focus]);

  function leaveWebFullscreen() {
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function toggleFocus() {
    const next = !focus;
    if (WEB_FOCUS_SUPPORTED) {
      // Must start from this tap: full screen first, then landscape.
      if (next) {
        document.documentElement
          .requestFullscreen()
          .then(() => (screen.orientation as LockableOrientation).lock?.('landscape'))
          .catch(() => {});
      } else {
        leaveWebFullscreen();
      }
    }
    setFocus(next);
    if (Platform.OS !== 'web') storageSave(FOCUS_KEY, next ? '1' : '0').catch(() => {});
  }

  const leftTeam: Team = teamASide === 'left' ? 'A' : 'B';
  const rightTeam: Team = leftTeam === 'A' ? 'B' : 'A';

  const leftPoint = getPointLabel(matchState, leftTeam);
  const rightPoint = getPointLabel(matchState, rightTeam);
  const servingTeam = getServerTeam(matchState);
  const leftIsServing = servingTeam === leftTeam;
  const rightIsServing = !leftIsServing;

  const leftPlayers = matchState.config.players.filter(p => p.team === leftTeam);
  const rightPlayers = matchState.config.players.filter(p => p.team === rightTeam);

  const leftGames = matchState.games[leftTeam];
  const rightGames = matchState.games[rightTeam];
  const leftSets = matchState.sets[leftTeam];
  const rightSets = matchState.sets[rightTeam];
  const hasSets = leftSets > 0 || rightSets > 0;

  const isAdvantage = (matchState.points.A + matchState.points.B) % 2 === 1;

  const fmt = matchState.config.matchFormat ?? { type: 'open' };
  const isCustomFormat = fmt.type !== 'best-of-sets';
  const formatLabel: string | null =
    matchState.tiebreak
      ? matchState.tiebreak.target === 10 ? 'SUPER TB' : 'TIEBREAK'
      : fmt.type === 'fixed-games'
      ? `${leftGames + rightGames} / ${fmt.totalGames}${fmt.goldenGameOnTie && leftGames + rightGames === fmt.totalGames && leftGames === rightGames ? ' ★' : ''}`
      : fmt.type === 'race-to'
      ? `→ ${fmt.raceTo}`
      : fmt.type === 'best-of-sets'
      ? `BO${fmt.setsToWin * 2 - 1}`
      : null;

  // The format in words, for normal mode's score card.
  const formatText: string | null = matchState.tiebreak
    ? matchState.tiebreak.target === 10 ? t('scoringSuperTiebreak') : t('scoringTiebreak')
    : fmt.type === 'race-to'
    ? t('scoringFormatRaceTo', fmt.raceTo)
    : fmt.type === 'fixed-games'
    ? t('scoringFormatFixedGames', leftGames + rightGames, fmt.totalGames)
    : fmt.type === 'best-of-sets'
    ? t('scoringFormatBestOf', fmt.setsToWin * 2 - 1)
    : null;

  // ── Long-press end match handlers ─────────────────────────────────────────

  function handleAkhiriPressIn() {
    const anim = Animated.timing(pressAnim, { toValue: 1, duration: HOLD_MS, useNativeDriver: true });
    holdAnim.current = anim;
    anim.start(({ finished }) => {
      holdAnim.current = null;
      if (!finished) return; // released early
      Animated.timing(pressAnim, { toValue: 0, duration: 0, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setShowEndConfirm(true);
    });
  }

  function handleAkhiriPressOut() {
    if (!holdAnim.current) return; // animation already completed — modal is showing
    holdAnim.current.stop();
    holdAnim.current = null;
    Animated.timing(pressAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }

  // Fires on every completed tap regardless of hold duration. If the hold
  // already succeeded, showEndConfirm is true by the time this runs (it's
  // set synchronously inside the animation callback, before release) — skip
  // the hint in that case so we don't show it right next to the dialog.
  function handleAkhiriTap() {
    if (showEndConfirm) return;
    Haptics.selectionAsync().catch(() => {});
    setShowHoldHint(true);
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    hintTimeout.current = setTimeout(() => setShowHoldHint(false), 1800);
  }

  const pointLog = buildLog(history, matchState);

  // ── Shared pieces ─────────────────────────────────────────────────────────

  function endButton(style: 'tab' | 'outline') {
    return (
      <TouchableOpacity
        onPressIn={handleAkhiriPressIn}
        onPressOut={handleAkhiriPressOut}
        onPress={handleAkhiriTap}
        activeOpacity={1}
        accessibilityLabel={t('endMatchTitle')}
        style={
          style === 'tab'
            ? { backgroundColor: '#1e293b', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 8, borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center', overflow: 'hidden' }
            : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ef4444', overflow: 'hidden' }
        }
      >
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: style === 'tab' ? '#991b1b' : 'rgba(239,68,68,0.25)', opacity: pressAnim }} />
        {style === 'tab' ? (
          <Ionicons name="stop-circle-outline" size={30} color="#fca5a5" />
        ) : (
          <>
            <Ionicons name="stop-circle-outline" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>{t('endMatchShort')}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  function holdHint(place: { bottom: number } | { top: number; left: number }) {
    if (!showHoldHint) return null;
    return (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', ...place, ...('bottom' in place ? { alignSelf: 'center' as const } : {}), zIndex: 10, backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, minWidth: 200, alignItems: 'center' }}
      >
        <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>{t('holdToEndHint')}</Text>
      </View>
    );
  }

  function liveBadge() {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' }} />
        <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>{t('liveMatchBadge')}</Text>
        {scorerName && <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600' }}>· {t('scoredBy', scorerName)}</Text>}
      </View>
    );
  }

  function iconButton(name: ComponentProps<typeof Ionicons>['name'], onPress: () => void, color: string, label: string, bg = '#1e293b') {
    return (
      <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={{ padding: 10, backgroundColor: bg, borderRadius: 12 }}>
        <Ionicons name={name} size={18} color={color} />
      </Pressable>
    );
  }

  // ── Focus mode: landscape, full-screen court ─────────────────────────────

  function renderFocus() {
    // Sized from the court's real size, not the window's (on web the app
    // is a phone-width column).
    const scoreFontSize = court.width > 0 ? Math.floor(Math.min(court.height * 0.6, (court.width / 2) * 0.6)) : 120;
    const leftBallPos = isAdvantage
      ? { position: 'absolute' as const, top: 14, left: 14 }
      : { position: 'absolute' as const, bottom: 14, left: 14 };
    const rightBallPos = isAdvantage
      ? { position: 'absolute' as const, bottom: 14, right: 14 }
      : { position: 'absolute' as const, top: 14, right: 14 };

    return (
      <View
        style={[
          { flex: 1, backgroundColor: '#020617' },
          // Web: the whole screen, not just the app's phone-width column.
          Platform.OS === 'web' ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 } as object) : null,
        ]}
      >
        <StatusBar hidden />
        <View
          style={{ flex: 1, flexDirection: 'row' }}
          onLayout={(e) => setCourt({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <TouchableOpacity activeOpacity={readOnly ? 1 : 0.85} disabled={readOnly} onPress={() => onAddPoint(leftTeam)} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>{leftPoint}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={readOnly ? 1 : 0.85} disabled={readOnly} onPress={() => onAddPoint(rightTeam)} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>{rightPoint}</Text>
            </View>
          </TouchableOpacity>

          {/* Net */}
          <View pointerEvents="none" style={{ position: 'absolute', left: '50%', marginLeft: -2, top: 0, bottom: 0, width: 4, backgroundColor: 'rgba(255,255,255,0.9)' }} />

          {/* Score box */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <View
              onLayout={e => setScoreBoxHalfW(e.nativeEvent.layout.width / 2)}
              style={{ backgroundColor: '#0f172a', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 9, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center' }}
            >
              {isCustomFormat ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 36, fontWeight: '900', color: '#f8fafc', minWidth: 30, textAlign: 'center' }}>{leftGames}</Text>
                    <Text style={{ fontSize: 20, color: '#475569', marginHorizontal: 10 }}>–</Text>
                    <Text style={{ fontSize: 36, fontWeight: '900', color: '#f8fafc', minWidth: 30, textAlign: 'center' }}>{rightGames}</Text>
                  </View>
                  {formatLabel && <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>}
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, opacity: hasSets ? 1 : 0 }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: leftSets > rightSets ? '#f8fafc' : '#475569', minWidth: 22, textAlign: 'center' }}>{leftSets}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', marginHorizontal: 8 }}>–</Text>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: rightSets > leftSets ? '#f8fafc' : '#475569', minWidth: 22, textAlign: 'center' }}>{rightSets}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#f8fafc', minWidth: 16, textAlign: 'center' }}>{leftGames}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginHorizontal: 8 }}>–</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#f8fafc', minWidth: 16, textAlign: 'center' }}>{rightGames}</Text>
                  </View>
                  {formatLabel && <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>}
                </>
              )}
            </View>
          </View>

          {/* Left of the score box: leave focus mode */}
          {scoreBoxHalfW > 0 && (
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 6, right: '50%', marginRight: scoreBoxHalfW + 10 }}>
              {iconButton('contract-outline', toggleFocus, '#94a3b8', t('scoringExitFocus'))}
            </View>
          )}

          {/* Right of the score box: voice (scorer) and point log */}
          {scoreBoxHalfW > 0 && (
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 6, left: '50%', marginLeft: scoreBoxHalfW + 10, flexDirection: 'row', gap: 8 }}>
              {!readOnly && iconButton('megaphone-outline', onToggleVoice, voiceEnabled ? '#4ade80' : '#475569', t('scoringVoice'))}
              {iconButton('list-outline', () => setShowPointLog(true), '#94a3b8', t('pointLog'))}
            </View>
          )}

          {/* Undo on the net */}
          {!readOnly && (
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Pressable
                onPress={onUndo}
                disabled={!hasUndo}
                accessibilityLabel={t('scoringUndo')}
                style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569', opacity: hasUndo ? 1 : 0.5 }}
              >
                <Ionicons name="arrow-undo-outline" size={24} color="#e2e8f0" />
              </Pressable>
            </View>
          )}

          {/* Serve: ball in the deuce/advantage corner */}
          {leftIsServing && (
            <View pointerEvents="none" style={leftBallPos}>
              <Ionicons name="tennisball" size={44} color="#fde047" />
            </View>
          )}
          {rightIsServing && (
            <View pointerEvents="none" style={rightBallPos}>
              <Ionicons name="tennisball" size={44} color="#fde047" />
            </View>
          )}

          {/* Player names, stacked in each half */}
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row' }}>
            {[leftPlayers, rightPlayers].map((group, side) => (
              <View key={side} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 60, gap: 2 }}>
                {group.map((p) => (
                  <Text key={p.id} numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: p.id === matchState.currentServerPlayerId ? '#fde047' : '#ffffff' }}>
                    {p.name}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          {/* Bottom centre: hold-to-end (scorer) or LIVE badge (viewer) */}
          <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}>
            {!readOnly ? (
              <>
                {holdHint({ bottom: 56 })}
                {endButton('tab')}
              </>
            ) : (
              <View pointerEvents="none" style={{ marginBottom: 14 }}>{liveBadge()}</View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── Normal mode: portrait, the app's own look ─────────────────────────────

  function renderNormal() {
    const dark = colorScheme === 'dark';
    const toolBg = dark ? '#1e293b' : '#e2e8f0';
    const toolColor = dark ? '#94a3b8' : '#475569';
    // Cards are about as tall as they are wide (at most 320) rather than
    // filling the screen — big enough to tap, small enough not to be hit
    // by accident. Two characters ("15", "AD") fit with room to spare.
    const cardWidth = teamRow.width > 0 ? (teamRow.width - 12) / 2 : 160;
    const cardHeight = Math.min(320, Math.round(cardWidth * 1.1));
    const pointFontSize = Math.max(40, Math.floor(Math.min(cardWidth * 0.48, cardHeight * 0.4)));

    function teamCard(team: Team, players: typeof leftPlayers, point: string, serving: boolean, color: 'blue' | 'red') {
      return (
        <TouchableOpacity
          disabled={readOnly}
          activeOpacity={0.8}
          onPress={() => onAddPoint(team)}
          accessibilityLabel={t('scoringPointFor', players.map((p) => p.name).join(' / '))}
          style={{ flex: 1, minWidth: 0, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 16, backgroundColor: color === 'blue' ? '#1e3a8a' : '#7f1d1d' }}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            {players.map((p) => {
              const isServer = p.id === matchState.currentServerPlayerId;
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                  {isServer && <Ionicons name="tennisball" size={16} color="#fde047" />}
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: isServer ? '#fde047' : '#ffffff', flexShrink: 1 }}>
                    {p.name}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: pointFontSize, fontWeight: '900', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>{point}</Text>
          </View>
          <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#fde047', letterSpacing: 1, opacity: serving ? 1 : 0 }}>
            {t('scoringServing')}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <StatusBar style={dark ? 'light' : 'dark'} />
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 14 }}>
          {/* Top: status and tools */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexShrink: 1 }}>
              {readOnly ? liveBadge() : (
                <View>
                  {endButton('outline')}
                  {holdHint({ top: 44, left: 0 })}
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!readOnly && iconButton('megaphone-outline', onToggleVoice, voiceEnabled ? '#16a34a' : toolColor, t('scoringVoice'), toolBg)}
              {iconButton('list-outline', () => setShowPointLog(true), toolColor, t('pointLog'), toolBg)}
              {FOCUS_SUPPORTED && iconButton('expand-outline', toggleFocus, toolColor, t('scoringFocusMode'), toolBg)}
            </View>
          </View>

          {/* Games, big and centred; sets (once any is won) and the format below */}
          <View className="rounded-2xl bg-white dark:bg-slate-800 py-3 items-center">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text className="text-3xl font-black text-slate-900 dark:text-white">{leftGames}</Text>
              <Text className="text-xl text-slate-400 mx-3">–</Text>
              <Text className="text-3xl font-black text-slate-900 dark:text-white">{rightGames}</Text>
            </View>
            {!isCustomFormat && hasSets && (
              <Text className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{t('scoringSetsScore', leftSets, rightSets)}</Text>
            )}
            {formatText && <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{formatText}</Text>}
          </View>

          {/* The two teams, left and right — tap to score */}
          <View
            style={{ height: cardHeight, flexDirection: 'row', gap: 12 }}
            onLayout={(e) => setTeamRow({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            {teamCard(leftTeam, leftPlayers, leftPoint, leftIsServing, 'blue')}
            {teamCard(rightTeam, rightPlayers, rightPoint, rightIsServing, 'red')}
          </View>

          {/* Undo, centred under the two teams */}
          {!readOnly && (
            <View style={{ alignItems: 'center' }}>
              <Pressable
                onPress={onUndo}
                disabled={!hasUndo}
                accessibilityLabel={t('scoringUndo')}
                hitSlop={6}
                style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: dark ? '#475569' : '#cbd5e1', opacity: hasUndo ? 1 : 0.5 }}
              >
                <Ionicons name="arrow-undo-outline" size={24} color={dark ? '#e2e8f0' : '#0f172a'} />
              </Pressable>
            </View>
          )}

        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {focus ? renderFocus() : renderNormal()}

      {/* End match confirmation */}
      <Modal visible={showEndConfirm} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} onRequestClose={() => setShowEndConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 28, width: '88%', maxWidth: 360, gap: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#f1f5f9', textAlign: 'center' }}>{t('endMatchTitle')}</Text>
            <Text style={{ fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>{t('endMatchConfirm')}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Pressable
                onPress={() => setShowEndConfirm(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#334155', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#94a3b8' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => { setShowEndConfirm(false); onEndMatch(); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#991b1b', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#fca5a5' }}>{t('endMatchShort')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Point log panel */}
      {showPointLog && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowPointLog(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 20, width: '90%', maxWidth: 480, maxHeight: '85%' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#f8fafc' }}>{t('pointLog')}</Text>
              <Pressable onPress={() => setShowPointLog(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>
            {pointLog.length === 0 ? (
              <Text style={{ color: '#475569', fontSize: 15, textAlign: 'center', paddingVertical: 20 }}>{t('noPoints')}</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {pointLog.map((entry, i) => {
                  const isLeft = entry.scorer === leftTeam;
                  const entryName = entry.scorer === 'A' ? teamNames.A : teamNames.B;
                  const isGameOrSet = entry.kind !== 'point';
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: '#1e3a5f',
                        backgroundColor: isGameOrSet ? 'rgba(255,255,255,0.04)' : 'transparent',
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLeft ? '#60a5fa' : '#f87171', marginRight: 8 }} />
                      <Text style={{ color: isLeft ? '#93c5fd' : '#fca5a5', fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>
                        {entryName}
                      </Text>
                      <Text style={{ color: isGameOrSet ? '#f8fafc' : '#94a3b8', fontSize: 13, fontWeight: isGameOrSet ? '700' : '400' }}>
                        {entry.kind === 'set'
                          ? `SET ${entry.setA}–${entry.setB}`
                          : entry.kind === 'game'
                          ? `Game  ${entry.gameA}–${entry.gameB}`
                          : `${entry.pointA} – ${entry.pointB}`}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}
