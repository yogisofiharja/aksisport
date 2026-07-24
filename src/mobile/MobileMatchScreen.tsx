import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { TeamNames, TeamASide } from '../appTypes';
import { getPointLabel, MatchState, Team } from '../sports/tennis/scoringEngine';
import { useTranslation } from '../i18n';

const HOLD_MS = 700;

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  teamASide: TeamASide;
  history: MatchState[];
  hasUndo: boolean;
  voiceEnabled: boolean;
  watchUrl?: string | null;
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

export function MobileMatchScreen({
  matchState,
  teamNames,
  teamASide,
  history,
  hasUndo,
  voiceEnabled,
  watchUrl,
  readOnly = false,
  scorerName,
  onAddPoint,
  onUndo,
  onEndMatch,
  onToggleVoice,
}: Props) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPointLog, setShowPointLog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showHoldHint, setShowHoldHint] = useState(false);
  const [scoreBoxHalfW, setScoreBoxHalfW] = useState(0);

  const pressAnim = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { height: wh, width: ww } = useWindowDimensions();
  const { t } = useTranslation();
  const courtHeight = Math.min(wh, ww);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      holdAnim.current?.stop();
      if (hintTimeout.current) clearTimeout(hintTimeout.current);
    };
  }, []);

  const leftTeam: Team = teamASide === 'left' ? 'A' : 'B';
  const rightTeam: Team = leftTeam === 'A' ? 'B' : 'A';

  const leftPoint = getPointLabel(matchState, leftTeam);
  const rightPoint = getPointLabel(matchState, rightTeam);
  const leftIsServing = matchState.currentServerPlayerId.startsWith(leftTeam);
  const rightIsServing = !leftIsServing;

  const leftPlayers = matchState.config.players.filter(p => p.team === leftTeam);
  const rightPlayers = matchState.config.players.filter(p => p.team === rightTeam);

  const leftGames = matchState.games[leftTeam];
  const rightGames = matchState.games[rightTeam];
  const leftSets = matchState.sets[leftTeam];
  const rightSets = matchState.sets[rightTeam];
  const hasSets = leftSets > 0 || rightSets > 0;

  const isAdvantage = (matchState.points.A + matchState.points.B) % 2 === 1;
  const scoreFontSize = courtHeight > 0 ? Math.floor(courtHeight * 0.70) : 240;

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

  const leftBallPos = isAdvantage
    ? { position: 'absolute' as const, top: 14, left: 14 }
    : { position: 'absolute' as const, bottom: 14, left: 14 };
  const rightBallPos = isAdvantage
    ? { position: 'absolute' as const, bottom: 14, right: 14 }
    : { position: 'absolute' as const, top: 14, right: 14 };

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

  // ── Point log ────────────────────────────────────────────────────────────

  const pointLog = buildLog(history, matchState);

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar hidden />

      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* Left (blue) side */}
        <TouchableOpacity activeOpacity={readOnly ? 1 : 0.85} disabled={readOnly} onPress={() => onAddPoint(leftTeam)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>
              {leftPoint}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right (red) side */}
        <TouchableOpacity activeOpacity={readOnly ? 1 : 0.85} disabled={readOnly} onPress={() => onAddPoint(rightTeam)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>
              {rightPoint}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Net */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: '50%', marginLeft: -2, top: 0, bottom: 0, width: 4, backgroundColor: 'rgba(255,255,255,0.9)' }}
        />

        {/* ── Score box: own centred container ── */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            onLayout={e => setScoreBoxHalfW(e.nativeEvent.layout.width / 2)}
            style={{ backgroundColor: '#0f172a', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 9, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center' }}
          >
            {isCustomFormat ? (
              /* Custom format: large game score only, no set row */
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 36, fontWeight: '900', color: '#fbbf24', minWidth: 30, textAlign: 'center' }}>{leftGames}</Text>
                  <Text style={{ fontSize: 20, color: '#475569', marginHorizontal: 10 }}>–</Text>
                  <Text style={{ fontSize: 36, fontWeight: '900', color: '#fbbf24', minWidth: 30, textAlign: 'center' }}>{rightGames}</Text>
                </View>
                {formatLabel && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>
                )}
              </>
            ) : (
              /* Regular (best-of-sets): set row + smaller game row */
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, opacity: hasSets ? 1 : 0 }}>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: leftSets > rightSets ? '#f8fafc' : '#475569', minWidth: 22, textAlign: 'center' }}>{leftSets}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', marginHorizontal: 8 }}>–</Text>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: rightSets > leftSets ? '#f8fafc' : '#475569', minWidth: 22, textAlign: 'center' }}>{rightSets}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#fbbf24', minWidth: 16, textAlign: 'center' }}>{leftGames}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginHorizontal: 8 }}>–</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#fbbf24', minWidth: 16, textAlign: 'center' }}>{rightGames}</Text>
                </View>
                {formatLabel && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Suara button: right of score box ── */}
        {!readOnly && scoreBoxHalfW > 0 && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 6, left: '50%', marginLeft: scoreBoxHalfW + 10 }}
          >
            <Pressable
              onPress={onToggleVoice}
              style={{ padding: 10, backgroundColor: '#1e293b', borderRadius: 12 }}
            >
              <Ionicons name="megaphone-outline" size={18} color={voiceEnabled ? '#4ade80' : '#475569'} />
            </Pressable>
          </View>
        )}

        {/* ── QR button: left of score box ── */}
        {scoreBoxHalfW > 0 && watchUrl && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 6, right: '50%', marginRight: scoreBoxHalfW + 10 }}
          >
            <Pressable
              onPress={() => setShowQrModal(true)}
              style={{ padding: 10, backgroundColor: '#1e293b', borderRadius: 12 }}
            >
              <Ionicons name="qr-code-outline" size={18} color="#94a3b8" />
            </Pressable>
          </View>
        )}

        {/* ── Point log button: right of sound button ── */}
        {scoreBoxHalfW > 0 && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 6, left: '50%', marginLeft: scoreBoxHalfW + 56 }}
          >
            <Pressable
              onPress={() => setShowPointLog(true)}
              style={{ padding: 10, backgroundColor: '#1e293b', borderRadius: 12 }}
            >
              <Ionicons name="list-outline" size={18} color="#94a3b8" />
            </Pressable>
          </View>
        )}


  {/* ── Undo button ── */}
        {!readOnly && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Pressable
              onPress={onUndo}
              disabled={!hasUndo}
              style={{ padding: 14, backgroundColor: '#ea580c', borderRadius: 18 }}
            >
              <Ionicons name="arrow-undo-outline" size={24} color={hasUndo ? '#ffffff' : '#9a3412'} />
            </Pressable>
          </View>
        )}

        {/* ── Tennis ball: deuce / advantage corner ── */}
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

        {/* ── Akhiri: long-press to end match (scorer only) ── */}
        {!readOnly ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}
          >
            {showHoldHint && (
              // Fixed bottom offset, not bottom: '100%' — this container's
              // height is content-driven (just the button, ~48px), and
              // percentage positioning against a content-sized parent is
              // unreliable in Yoga. 56px clears the button with a small gap.
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 56,
                  backgroundColor: '#1e293b',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>{t('holdToEndHint')}</Text>
              </View>
            )}
            <TouchableOpacity
              onPressIn={handleAkhiriPressIn}
              onPressOut={handleAkhiriPressOut}
              onPress={handleAkhiriTap}
              activeOpacity={1}
              style={{
                backgroundColor: '#1e293b',
                paddingHorizontal: 22,
                paddingTop: 10,
                paddingBottom: 8,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Fill progress animation */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#991b1b',
                  opacity: pressAnim,
                }}
              />
              <Ionicons name="stop-circle-outline" size={30} color="#fca5a5" />
            </TouchableOpacity>
          </View>
        ) : (
          /* ── LIVE badge: viewer mode, shows who's scoring ── */
          /* bottom: 46, not 14 — must clear the player-names row below
             (bottom: 10, ~18px text), which this badge previously overlapped
             since its "Scored by <name>" text can be wider than Akhiri's
             compact icon button ever was. */
          <View
            pointerEvents="none"
            style={{ position: 'absolute', bottom: 46, left: 0, right: 0, alignItems: 'center' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#1e293b',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' }} />
              <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>
                {t('liveMatchBadge')}
              </Text>
              {scorerName && (
                <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600' }}>
                  · {t('scoredBy', scorerName)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Player names ── */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row' }}
        >
          <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 80 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              {leftPlayers.flatMap((p, i) => [
                ...(i > 0 ? [<Text key={`ls${i}`} style={{ fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.35)' }}> / </Text>] : []),
                <Text key={p.id} style={{ fontSize: 18, fontWeight: '800', color: p.id === matchState.currentServerPlayerId ? '#fde047' : '#ffffff' }}>{p.name}</Text>,
              ])}
            </View>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 80 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              {rightPlayers.flatMap((p, i) => [
                ...(i > 0 ? [<Text key={`rs${i}`} style={{ fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.35)' }}> / </Text>] : []),
                <Text key={p.id} style={{ fontSize: 18, fontWeight: '800', color: p.id === matchState.currentServerPlayerId ? '#fde047' : '#ffffff' }}>{p.name}</Text>,
              ])}
            </View>
          </View>
        </View>

      </View>

      {/* QR code popup */}
      {showQrModal && watchUrl && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowQrModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: '#1e293b', borderRadius: 24, padding: 32, alignItems: 'center' }}
          >
            <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16 }}>
              <QRCode value={watchUrl} size={180} color="#0f172a" backgroundColor="#f8fafc" />
            </View>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 16, textAlign: 'center', maxWidth: 220 }} numberOfLines={2}>
              {watchUrl}
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{t('scanToWatch')}</Text>
          </Pressable>
        </Pressable>
      )}

      {/* End match confirmation modal (landscape-safe) */}
      <Modal visible={showEndConfirm} transparent animationType="fade" supportedOrientations={['landscape', 'landscape-left', 'landscape-right']} onRequestClose={() => setShowEndConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 28, width: 320, gap: 16 }}>
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
            style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 20, width: '70%', maxHeight: '85%' }}
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
                  const scorerName = entry.scorer === 'A' ? teamNames.A : teamNames.B;
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
                        {scorerName}
                      </Text>
                      <Text style={{ color: isGameOrSet ? '#fbbf24' : '#94a3b8', fontSize: 13, fontWeight: isGameOrSet ? '700' : '400' }}>
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
