import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState, type ComponentProps } from 'react';
import { Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { TeamNames, TeamASide } from '../appTypes';
import { getPointLabel, getServerTeam, MatchState, Team } from '../sports/tennis/scoringEngine';
import { storageGet, storageSave } from '../storage';
import { useTranslation } from '../i18n';
import { color } from '../design-system/foundation/colors';
import { AppBar } from '../design-system/layout/AppBar';

// Team sides (Aksi Sport): left in heat with ink text, right in asphalt
// with light text — the same in both themes, like a broadcast scoreboard.
const SIDE = {
  left: { bg: color.heat.light, fg: color.onHeat.light },
  right: { bg: color.asphalt.light, fg: color.onAsphalt.light },
} as const;

// The serving ball, on a small dark disc so it reads on either side.
function ServeBall({ size }: { size: number }) {
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: color.asphalt.light, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="tennisball" size={size} color={color.ball.light} />
    </View>
  );
}

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
  /** Viewer mode: no scoring or undo controls. */
  readOnly?: boolean;
  /** The umpire, shown in the LIVE badge when readOnly. */
  scorerName?: string | null;
  /** Leaves the screen; a live match keeps going. */
  onBack: () => void;
  onAddPoint: (team: Team) => void;
  onUndo: () => void;
  onToggleVoice: () => void;
  /** The umpire's Match options (DP-023); no button when absent. */
  onOpenOptions?: () => void;
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
// (undo, voice, point log, Match options) and their dialogs.
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
  onBack,
  onUndo,
  onToggleVoice,
  onOpenOptions,
}: Props) {
  const [focus, setFocus] = useState(false);
  const [showPointLog, setShowPointLog] = useState(false);
  const [scoreBoxHalfW, setScoreBoxHalfW] = useState(0);
  // Normal mode sizes the scores from the team row's real size (the app
  // can be narrower than the window, e.g. the phone-width column on web).
  const [teamRow, setTeamRow] = useState({ width: 0, height: 0 });
  const [court, setCourt] = useState({ width: 0, height: 0 });


  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const themeMode = colorScheme === 'dark' ? 'dark' : 'light';

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

  const pointLog = buildLog(history, matchState);

  // ── Shared pieces ─────────────────────────────────────────────────────────

  function liveBadge() {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.asphalt.dark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.heat.light }} />
        <Text style={{ color: color.heatOnAsphalt.light, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>{t('liveMatchBadge')}</Text>
        {scorerName && <Text style={{ color: color.onAsphalt.light, fontSize: 12, fontWeight: '600' }}>· {t('umpireLabel', scorerName)}</Text>}
      </View>
    );
  }

  function iconButton(name: ComponentProps<typeof Ionicons>['name'], onPress: () => void, iconColor: string, label: string, bg: string = color.asphalt.dark) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={{ padding: 10, backgroundColor: bg, borderRadius: 12 }}>
        <Ionicons name={name} size={18} color={iconColor} />
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
          { flex: 1, backgroundColor: color.ground.dark },
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
            <View style={{ flex: 1, backgroundColor: SIDE.left.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: SIDE.left.fg, letterSpacing: -2, includeFontPadding: false }}>{leftPoint}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={readOnly ? 1 : 0.85} disabled={readOnly} onPress={() => onAddPoint(rightTeam)} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: SIDE.right.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: SIDE.right.fg, letterSpacing: -2, includeFontPadding: false }}>{rightPoint}</Text>
            </View>
          </TouchableOpacity>

          {/* Net */}
          <View pointerEvents="none" style={{ position: 'absolute', left: '50%', marginLeft: -2, top: 0, bottom: 0, width: 4, backgroundColor: 'rgba(255,255,255,0.9)' }} />

          {/* Score box */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <View
              onLayout={e => setScoreBoxHalfW(e.nativeEvent.layout.width / 2)}
              style={{ backgroundColor: color.asphalt.light, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 9, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center' }}
            >
              {isCustomFormat ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 36, fontWeight: '900', color: color.onAsphalt.light, minWidth: 30, textAlign: 'center' }}>{leftGames}</Text>
                    <Text style={{ fontSize: 20, color: color.inkFaint.dark, marginHorizontal: 10 }}>–</Text>
                    <Text style={{ fontSize: 36, fontWeight: '900', color: color.onAsphalt.light, minWidth: 30, textAlign: 'center' }}>{rightGames}</Text>
                  </View>
                  {formatLabel && <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint.dark, marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>}
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, opacity: hasSets ? 1 : 0 }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: leftSets > rightSets ? color.onAsphalt.light : color.inkFaint.dark, minWidth: 22, textAlign: 'center' }}>{leftSets}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: color.inkFaint.dark, marginHorizontal: 8 }}>–</Text>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: rightSets > leftSets ? color.onAsphalt.light : color.inkFaint.dark, minWidth: 22, textAlign: 'center' }}>{rightSets}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: color.onAsphalt.light, minWidth: 16, textAlign: 'center' }}>{leftGames}</Text>
                    <Text style={{ fontSize: 12, color: color.inkFaint.dark, marginHorizontal: 8 }}>–</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: color.onAsphalt.light, minWidth: 16, textAlign: 'center' }}>{rightGames}</Text>
                  </View>
                  {formatLabel && <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint.dark, marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>}
                </>
              )}
            </View>
          </View>

          {/* Left of the score box: leave focus mode */}
          {scoreBoxHalfW > 0 && (
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 6, right: '50%', marginRight: scoreBoxHalfW + 10 }}>
              {iconButton('contract-outline', toggleFocus, color.inkMuted.dark, t('scoringExitFocus'))}
            </View>
          )}

          {/* Right of the score box: voice (scorer) and point log */}
          {scoreBoxHalfW > 0 && (
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 6, left: '50%', marginLeft: scoreBoxHalfW + 10, flexDirection: 'row', gap: 8 }}>
              {!readOnly && iconButton('megaphone-outline', onToggleVoice, voiceEnabled ? color.success.dark : color.inkFaint.dark, t('scoringVoice'))}
              {iconButton('list-outline', () => setShowPointLog(true), color.inkMuted.dark, t('pointLog'))}
              {!readOnly && onOpenOptions && iconButton('ellipsis-horizontal', onOpenOptions, color.inkMuted.dark, t('matchOptions'))}
            </View>
          )}

          {/* Undo on the net */}
          {!readOnly && (
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Pressable
                onPress={onUndo}
                disabled={!hasUndo}
                accessibilityLabel={t('scoringUndo')}
                style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: color.asphalt.dark, borderWidth: 1, borderColor: color.inkFaint.dark, opacity: hasUndo ? 1 : 0.5 }}
              >
                <Ionicons name="arrow-undo-outline" size={24} color="#e2e8f0" />
              </Pressable>
            </View>
          )}

          {/* Serve: ball in the deuce/advantage corner */}
          {leftIsServing && (
            <View pointerEvents="none" style={leftBallPos}>
              <ServeBall size={40} />
            </View>
          )}
          {rightIsServing && (
            <View pointerEvents="none" style={rightBallPos}>
              <ServeBall size={40} />
            </View>
          )}

          {/* Player names, stacked in each half */}
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row' }}>
            {[leftPlayers, rightPlayers].map((group, side) => (
              <View key={side} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 60, gap: 2 }}>
                {group.map((p) => (
                  <Text key={p.id} numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: side === 0 ? SIDE.left.fg : SIDE.right.fg, textDecorationLine: p.id === matchState.currentServerPlayerId ? 'underline' : 'none' }}>
                    {p.name}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          {/* Bottom centre: the LIVE badge (viewer) */}
          {readOnly && (
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ marginBottom: 14 }}>{liveBadge()}</View>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Normal mode: portrait, the app's own look ─────────────────────────────

  function renderNormal() {
    const dark = colorScheme === 'dark';
    const mode = dark ? 'dark' : 'light';
    const toolBg = color.surfaceSunken[mode];
    const toolColor = color.inkMuted[mode];
    // Cards are about as tall as they are wide (at most 320) rather than
    // filling the screen — big enough to tap, small enough not to be hit
    // by accident. Two characters ("15", "AD") fit with room to spare.
    const cardWidth = teamRow.width > 0 ? (teamRow.width - 12) / 2 : 160;
    const cardHeight = Math.min(320, Math.round(cardWidth * 1.1));
    const pointFontSize = Math.max(40, Math.floor(Math.min(cardWidth * 0.48, cardHeight * 0.4)));

    function teamCard(team: Team, players: typeof leftPlayers, point: string, serving: boolean, side: 'left' | 'right') {
      const { fg } = SIDE[side];
      // Asphalt lifts a little in dark mode so the card stands off the ground.
      const bg = side === 'right' ? color.asphalt[mode] : SIDE.left.bg;
      return (
        <TouchableOpacity
          disabled={readOnly}
          activeOpacity={0.8}
          onPress={() => onAddPoint(team)}
          accessibilityLabel={t('scoringPointFor', players.map((p) => p.name).join(' / '))}
          style={{ flex: 1, minWidth: 0, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 16, backgroundColor: bg }}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            {players.map((p) => {
              const isServer = p.id === matchState.currentServerPlayerId;
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                  {isServer && <ServeBall size={14} />}
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: fg, flexShrink: 1 }}>
                    {p.name}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: pointFontSize, fontWeight: '900', color: fg, letterSpacing: -2, includeFontPadding: false }}>{point}</Text>
          </View>
          <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '800', color: fg, letterSpacing: 1, opacity: serving ? 1 : 0 }}>
            {t('scoringServing')}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-ground dark:bg-ground-dark">
        <StatusBar style="light" />
        {/* The dark scoring bar. Back, as on the Session screen; the match
            keeps going. The umpire ends one early from Match options
            (DP-025), behind ⋯. The point log sits here for a viewer and
            next to Undo for the umpire. */}
        <AppBar
          tone="dark"
          safeTop
          title={t('liveMatchTitle')}
          context={readOnly && scorerName ? t('umpireLabel', scorerName) : undefined}
          onBack={onBack}
          actions={[
            ...(FOCUS_SUPPORTED ? [{ icon: 'expand-outline' as const, label: t('scoringFocusMode'), onPress: toggleFocus }] : []),
            ...(readOnly ? [{ icon: 'list-outline' as const, label: t('pointLog'), onPress: () => setShowPointLog(true) }] : []),
          ]}
          onMore={!readOnly ? onOpenOptions : undefined}
        />
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 14 }}>

          {/* Games, big and centred; sets (once any is won) and the format below */}
          <View className="rounded-2xl bg-surface dark:bg-surface-dark py-3 items-center">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text className="text-3xl font-black text-ink dark:text-ink-dark">{leftGames}</Text>
              <Text className="text-xl text-ink-muted dark:text-ink-muted-dark mx-3">–</Text>
              <Text className="text-3xl font-black text-ink dark:text-ink-dark">{rightGames}</Text>
            </View>
            {!isCustomFormat && hasSets && (
              <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark mt-1">{t('scoringSetsScore', leftSets, rightSets)}</Text>
            )}
            {formatText && <Text className="text-xs font-semibold text-ink-muted dark:text-ink-muted-dark mt-1">{formatText}</Text>}
          </View>

          {/* The two teams, left and right — tap to score */}
          <View
            style={{ height: cardHeight, flexDirection: 'row', gap: 12 }}
            onLayout={(e) => setTeamRow({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            {teamCard(leftTeam, leftPlayers, leftPoint, leftIsServing, 'left')}
            {teamCard(rightTeam, rightPlayers, rightPoint, rightIsServing, 'right')}
          </View>

          {/* Undo, centred under the two teams, with the umpire's voice and
              point log beside it */}
          {!readOnly && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              {iconButton('megaphone-outline', onToggleVoice, voiceEnabled ? color.success[mode] : toolColor, t('scoringVoice'), toolBg)}
              <Pressable
                onPress={onUndo}
                disabled={!hasUndo}
                accessibilityLabel={t('scoringUndo')}
                hitSlop={6}
                style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface[mode], borderWidth: 1, borderColor: dark ? color.borderStrong.dark : color.onAsphalt.light, opacity: hasUndo ? 1 : 0.5 }}
              >
                <Ionicons name="arrow-undo-outline" size={24} color={color.ink[mode]} />
              </Pressable>
              {iconButton('list-outline', () => setShowPointLog(true), toolColor, t('pointLog'), toolBg)}
            </View>
          )}

        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {focus ? renderFocus() : renderNormal()}

      {/* Point log panel */}
      {showPointLog && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowPointLog(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: color.asphalt.dark, borderRadius: 20, padding: 20, width: '90%', maxWidth: 480, maxHeight: '85%' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: color.onAsphalt.light }}>{t('pointLog')}</Text>
              <Pressable onPress={() => setShowPointLog(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>
            {pointLog.length === 0 ? (
              <Text style={{ color: color.inkFaint.dark, fontSize: 15, textAlign: 'center', paddingVertical: 20 }}>{t('noPoints')}</Text>
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
                        borderBottomColor: color.border.dark,
                        backgroundColor: isGameOrSet ? 'rgba(255,255,255,0.04)' : 'transparent',
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLeft ? color.heat.light : color.onAsphalt.light, marginRight: 8 }} />
                      <Text style={{ color: isLeft ? color.heatOnAsphalt.light : color.onAsphalt.light, fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>
                        {entryName}
                      </Text>
                      <Text style={{ color: isGameOrSet ? color.onAsphalt.light : color.inkMuted.dark, fontSize: 13, fontWeight: isGameOrSet ? '700' : '400' }}>
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
