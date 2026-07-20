import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { TeamASide, TeamNames } from '../appTypes';
import { getPointLabel, MatchState, Team } from '../sports/tennis/scoringEngine';
import { Button, DecorativeBackdrop } from './ui';
import { SessionCodeBadge } from './SessionCodeBadge';
import { useTranslation } from '../i18n';

type MatchScreenProps = {
  matchState: MatchState;
  teamNames: TeamNames;
  teamASide: TeamASide;
  hasUndo: boolean;
  sessionCode: string | null;
  voiceEnabled: boolean;
  onAddPoint: (team: Team) => void;
  onUndo: () => void;
  onEndMatch: () => void;
  onToggleVoice: () => void;
};

export function MatchScreen(props: MatchScreenProps) {
  const { matchState, teamNames, teamASide, hasUndo, sessionCode, voiceEnabled, onAddPoint, onUndo, onEndMatch, onToggleVoice } = props;
  const { colorScheme } = useColorScheme();
  const statusStyle = Platform.OS === 'web' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark';
  const { t } = useTranslation();

  function handleEndMatch() {
    if (Platform.OS === 'web') {
      if (!window.confirm(t('endMatchConfirm'))) return;
      onEndMatch();
      return;
    }
    Alert.alert(t('endMatchTitle'), t('endMatchConfirm'), [
      { text: t('back'), style: 'cancel' },
      { text: t('endMatchShort'), style: 'destructive', onPress: onEndMatch },
    ]);
  }

  function handleUndo() {
    if (!hasUndo) return;
    onUndo();
  }

  const leftTeam: Team = teamASide === 'left' ? 'A' : 'B';
  const rightTeam: Team = leftTeam === 'A' ? 'B' : 'A';

  const scoreTapLeft = (
    <ScoreTapCard
      players={matchState.config.players.filter((player) => player.team === leftTeam).map((player) => player.name)}
      points={getPointLabel(matchState, leftTeam)}
      isServing={matchState.currentServerPlayerId.startsWith(leftTeam)}
      serverPlayerName={matchState.config.players.find((p) => p.id === matchState.currentServerPlayerId && p.team === leftTeam)?.name}
      onPress={() => onAddPoint(leftTeam)}
      tone="left"
    />
  );
  const scoreTapRight = (
    <ScoreTapCard
      players={matchState.config.players.filter((player) => player.team === rightTeam).map((player) => player.name)}
      points={getPointLabel(matchState, rightTeam)}
      isServing={matchState.currentServerPlayerId.startsWith(rightTeam)}
      serverPlayerName={matchState.config.players.find((p) => p.id === matchState.currentServerPlayerId && p.team === rightTeam)?.name}
      onPress={() => onAddPoint(rightTeam)}
      tone="right"
    />
  );
  const banner = (
    <TVScoreBanner
      leftName={teamNames[leftTeam]}
      rightName={teamNames[rightTeam]}
      leftSet={matchState.sets[leftTeam]}
      rightSet={matchState.sets[rightTeam]}
      leftGame={matchState.games[leftTeam]}
      rightGame={matchState.games[rightTeam]}
      leftPoint={getPointLabel(matchState, leftTeam)}
      rightPoint={getPointLabel(matchState, rightTeam)}
      leftIsServing={matchState.currentServerPlayerId.startsWith(leftTeam)}
      rightIsServing={matchState.currentServerPlayerId.startsWith(rightTeam)}
    />
  );
  const bottomBar = (
    <View style={styles.bottomActionWrap}>
      <View style={styles.controlsRow}>
        <LabeledIconButton icon="backspace-outline" onPress={handleUndo} disabled={!hasUndo} />
        <LabeledIconButton
          icon={voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
          onPress={onToggleVoice}
          active={voiceEnabled}
        />
      </View>
      <Button label={t('endMatch')} onPress={handleEndMatch} style={styles.endMatchButton} />
    </View>
  );

  if (Platform.OS !== 'web') {
    return (
      <LandscapeMatchScreen
        matchState={matchState}
        teamNames={teamNames}
        leftTeam={leftTeam}
        rightTeam={rightTeam}
        hasUndo={hasUndo}
        voiceEnabled={voiceEnabled}
        onAddPoint={onAddPoint}
        onUndo={handleUndo}
        onEndMatch={handleEndMatch}
        onToggleVoice={onToggleVoice}
      />
    );
  }

  return (
    <DecorativeBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={statusStyle} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.matchContainer}>
          <View style={styles.webHeader}>
            <SessionCodeBadge sessionCode={sessionCode} />
          </View>
          {banner}
          <View style={styles.scoreGrid}>
            {scoreTapLeft}
            {scoreTapRight}
          </View>
        </ScrollView>
        {bottomBar}
      </SafeAreaView>
    </DecorativeBackdrop>
  );
}

// ─── Landscape court layout (native only) ─────────────────────────────────────

type LandscapeProps = {
  matchState: MatchState;
  teamNames: TeamNames;
  leftTeam: Team;
  rightTeam: Team;
  hasUndo: boolean;
  voiceEnabled: boolean;
  onAddPoint: (t: Team) => void;
  onUndo: () => void;
  onEndMatch: () => void;
  onToggleVoice: () => void;
};

function LandscapeMatchScreen(p: LandscapeProps) {
  const { matchState, teamNames, leftTeam, rightTeam } = p;
  const { t } = useTranslation();
  const [courtHeight, setCourtHeight] = useState(0);

  // Lock to landscape for match play; restore portrait when unmounted
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const leftPlayers = matchState.config.players.filter(pl => pl.team === leftTeam).map(pl => pl.name);
  const rightPlayers = matchState.config.players.filter(pl => pl.team === rightTeam).map(pl => pl.name);
  const leftPoint = getPointLabel(matchState, leftTeam);
  const rightPoint = getPointLabel(matchState, rightTeam);
  const leftGames = matchState.games[leftTeam];
  const rightGames = matchState.games[rightTeam];
  const leftSets = matchState.sets[leftTeam];
  const rightSets = matchState.sets[rightTeam];
  const leftIsServing = matchState.currentServerPlayerId.startsWith(leftTeam);
  const rightIsServing = !leftIsServing;
  const leftServerName = matchState.config.players.find(pl => pl.id === matchState.currentServerPlayerId && pl.team === leftTeam)?.name ?? null;
  const rightServerName = matchState.config.players.find(pl => pl.id === matchState.currentServerPlayerId && pl.team === rightTeam)?.name ?? null;

  return (
    <View style={ls.root}>
      <StatusBar hidden />

      {/* ── Top header: names + set score box ────────────── */}
      <SafeAreaView edges={['top', 'left', 'right']} style={ls.header}>
        {/* Left team names */}
        <View style={ls.headerNames}>
          {leftPlayers.map(name => {
            const isServer = name === leftServerName;
            return (
              <View key={name} style={ls.nameRow}>
                {isServer && <View style={ls.serveDotLeft} />}
                <Text style={ls.nameText} numberOfLines={1}>{name}</Text>
              </View>
            );
          })}
        </View>

        {/* Center: set + game scorebox */}
        <View style={ls.centerBox}>
          <Text style={ls.centerLabel}>SET</Text>
          <View style={ls.setScoreRow}>
            <Text style={[ls.setNum, leftSets > rightSets && ls.setNumLeading]}>{leftSets}</Text>
            <Text style={ls.setDash}>–</Text>
            <Text style={[ls.setNum, rightSets > leftSets && ls.setNumLeading]}>{rightSets}</Text>
          </View>
          <View style={ls.gameScoreRow}>
            <Text style={ls.gameNum}>{leftGames}</Text>
            <Text style={ls.gameDash}>–</Text>
            <Text style={ls.gameNum}>{rightGames}</Text>
          </View>
          <Text style={ls.gameLabel}>GAME</Text>
        </View>

        {/* Right team names */}
        <View style={[ls.headerNames, ls.headerNamesRight]}>
          {rightPlayers.map(name => {
            const isServer = name === rightServerName;
            return (
              <View key={name} style={[ls.nameRow, { justifyContent: 'flex-end' }]}>
                <Text style={[ls.nameText, { textAlign: 'right' }]} numberOfLines={1}>{name}</Text>
                {isServer && <View style={ls.serveDotRight} />}
              </View>
            );
          })}
        </View>
      </SafeAreaView>

      {/* ── Court ─────────────────────────────────────────── */}
      <View
        style={ls.court}
        onLayout={e => setCourtHeight(e.nativeEvent.layout.height)}
      >
        {/* Left score box */}
        <Pressable
          onPress={() => p.onAddPoint(leftTeam)}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: '#172554',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            opacity: pressed ? 0.85 : 1,
            borderWidth: leftIsServing ? 3 : 0,
            borderColor: '#4ade80',
          })}
        >
          <Text style={{
            fontSize: courtHeight > 0 ? Math.floor(courtHeight * 0.65) : 90,
            fontWeight: '900',
            color: '#ffffff',
            textAlign: 'center',
            letterSpacing: -2,
          }}>
            {leftPoint}
          </Text>
          {leftIsServing && (
            <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '900', marginTop: 8, letterSpacing: 1 }}>
              ● SERVIS
            </Text>
          )}
        </Pressable>

        {/* Right score box */}
        <Pressable
          onPress={() => p.onAddPoint(rightTeam)}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: '#450a0a',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            opacity: pressed ? 0.85 : 1,
            borderWidth: rightIsServing ? 3 : 0,
            borderColor: '#4ade80',
          })}
        >
          <Text style={{
            fontSize: courtHeight > 0 ? Math.floor(courtHeight * 0.65) : 90,
            fontWeight: '900',
            color: '#ffffff',
            textAlign: 'center',
            letterSpacing: -2,
          }}>
            {rightPoint}
          </Text>
          {rightIsServing && (
            <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '900', marginTop: 8, letterSpacing: 1 }}>
              ● SERVIS
            </Text>
          )}
        </Pressable>

        <View style={ls.serviceLineLeft} pointerEvents="none" />
        <View style={ls.serviceLineRight} pointerEvents="none" />

        {/* Net divider */}
        <View style={ls.netDivider} pointerEvents="none">
          <View style={ls.netLine} />
        </View>
      </View>

      {/* ── Bottom bar ────────────────────────────────────── */}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={ls.bottomBar}>
        {/* Left: Akhiri Match — far from tap area, guarded by confirm dialog */}
        <Pressable
          onPress={p.onEndMatch}
          style={({ pressed }) => [ls.endBtn, pressed && ls.btnPressed]}
        >
          <Ionicons name="stop-circle-outline" size={18} color="#fca5a5" />
          <Text style={ls.endBtnText}>{t('endMatchShort')}</Text>
        </Pressable>

        {/* Center: Undo — arrow-undo icon, no label */}
        <Pressable
          onPress={p.onUndo}
          disabled={!p.hasUndo}
          style={({ pressed }) => [ls.undoBtn, !p.hasUndo && ls.btnDisabled, pressed && ls.btnPressed]}
        >
          <Ionicons name="arrow-undo-outline" size={26} color={p.hasUndo ? '#ffffff' : '#475569'} />
        </Pressable>

        {/* Right: Sound toggle */}
        <Pressable
          onPress={p.onToggleVoice}
          style={({ pressed }) => [ls.voiceBtn, pressed && ls.btnPressed]}
        >
          <Ionicons
            name={p.voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
            size={22}
            color={p.voiceEnabled ? '#4ade80' : '#94a3b8'}
          />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}


const ls = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
    flexDirection: 'column',
  },
  // ── Header ──────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerNames: {
    flex: 1,
    gap: 2,
  },
  headerNamesRight: {
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  serveDotLeft: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  serveDotRight: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  // ── Center score box ─────────────────
  centerBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginHorizontal: 12,
    minWidth: 120,
  },
  centerLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 1,
  },
  setScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setNum: {
    fontSize: 24,
    fontWeight: '900',
    color: '#64748b',
    minWidth: 18,
    textAlign: 'center',
  },
  setNumLeading: {
    color: '#f8fafc',
  },
  setDash: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  gameScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  gameNum: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fbbf24',
    minWidth: 14,
    textAlign: 'center',
  },
  gameDash: {
    fontSize: 10,
    color: '#64748b',
  },
  gameLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginTop: 1,
  },
  // ── Court ────────────────────────────
  court: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  serveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: 'rgba(74,222,128,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  serveIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  serveIndicatorText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4ade80',
    letterSpacing: 1.5,
  },
  serviceLineLeft: { display: 'none' },
  serviceLineRight: { display: 'none' },
  // ── Net divider (absolute, pinned to exact center) ─
  netDivider: {
    position: 'absolute',
    // '50%' positions the LEFT edge at the midpoint; shift back by half the line width
    left: '50%',
    marginLeft: -2,
    top: 0,
    bottom: 0,
    width: 4,
    flexDirection: 'column',
    alignItems: 'center',
  },
  netLine: {
    flex: 1,
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  // ── Bottom bar ───────────────────────
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15,23,42,0.95)',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.3)',
    backgroundColor: 'rgba(127,29,29,0.4)',
  },
  endBtnText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '800',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  voiceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});

// ─── Web-only helper components ────────────────────────────────────────────────

function TVScoreBanner(props: {
  leftName: string;
  rightName: string;
  leftSet: number;
  rightSet: number;
  leftGame: number;
  rightGame: number;
  leftPoint: string;
  rightPoint: string;
  leftIsServing: boolean;
  rightIsServing: boolean;
}) {
  return (
    <View style={styles.bannerTable}>
      <View style={styles.bannerHeaderRow}>
        <View style={styles.bannerNameCell} />
        <Text style={[styles.bannerColLabel, { width: 40 }]}>SET</Text>
        <Text style={[styles.bannerColLabel, { width: 40 }]}>GAME</Text>
        <Text style={[styles.bannerColLabel, { width: 60 }]}>POIN</Text>
      </View>
      <BannerRow name={props.leftName} set={props.leftSet} game={props.leftGame} point={props.leftPoint} isServing={props.leftIsServing} />
      <View style={styles.bannerDivider} />
      <BannerRow name={props.rightName} set={props.rightSet} game={props.rightGame} point={props.rightPoint} isServing={props.rightIsServing} />
    </View>
  );
}

function BannerRow(props: { name: string; set: number; game: number; point: string; isServing: boolean }) {
  return (
    <View style={styles.bannerTeamRow}>
      <View style={styles.bannerNameCell}>
        {props.isServing && <View style={styles.serveDot} />}
        <Text style={[styles.teamNameText, props.isServing && styles.teamNameServing]}>{props.name}</Text>
      </View>
      <Text style={styles.setCell}>{props.set}</Text>
      <Text style={styles.scoreCell}>{props.game}</Text>
      <Text style={styles.pointCell}>{props.point}</Text>
    </View>
  );
}

function ScoreTapCard(props: {
  players: string[];
  points: string;
  isServing: boolean;
  serverPlayerName: string | undefined;
  onPress: () => void;
  tone: 'left' | 'right';
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.06, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    props.onPress();
  }

  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={({ pressed }) => [
          styles.teamCard,
          props.tone === 'left' ? styles.teamCardLeft : styles.teamCardRight,
          props.isServing && styles.activeServerCard,
          pressed && styles.teamCardPressed,
        ]}
        onPress={handlePress}
      >
        <View style={styles.playerNamesWrap}>
          {props.players.map((name) => {
            const isServer = name === props.serverPlayerName;
            return (
              <View key={name} style={styles.playerNameRow}>
                {isServer && <View style={styles.playerServeDot} />}
                <Text style={[styles.teamName, isServer && styles.teamNameServeHighlight]}>
                  {name}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.pointValue}>{props.points}</Text>
        <Text style={styles.tapHint}>+1 poin</Text>
      </Pressable>
    </Animated.View>
  );
}

function LabeledIconButton(props: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      style={[styles.labeledButton, props.disabled && styles.actionButtonDisabled, props.active === false && styles.labeledButtonInactive]}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <Ionicons name={props.icon} size={18} color="#ffffff" />
      {props.label ? <Text style={styles.labeledButtonText}>{props.label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  matchContainer: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    paddingBottom: 12,
    gap: 12,
  },
  webHeader: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  bannerTable: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    overflow: 'hidden',
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  bannerColLabel: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(248,250,252,0.35)',
    letterSpacing: 1,
  },
  bannerTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    gap: 8,
  },
  bannerNameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  teamNameText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  teamNameServing: {
    color: '#4ade80',
  },
  bannerDivider: {
    height: 1,
    backgroundColor: '#334155',
  },
  setCell: {
    width: 40,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  scoreCell: {
    width: 40,
    textAlign: 'center',
    color: '#fde047',
    fontSize: 22,
    fontWeight: '900',
  },
  pointCell: {
    width: 60,
    textAlign: 'center',
    color: '#fbbf24',
    fontSize: 22,
    fontWeight: '900',
  },
  scoreGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  teamCard: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    justifyContent: 'space-between',
  },
  teamCardLeft: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  teamCardRight: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  teamNameServeHighlight: {
    color: '#166534',
    fontWeight: '900',
  },
  playerNamesWrap: {
    gap: 4,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  playerServeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  activeServerCard: {
    borderColor: '#22c55e',
  },
  teamCardPressed: {
    opacity: 0.82,
  },
  pointValue: {
    marginTop: 10,
    fontSize: 50,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
  },
  gameValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
    color: '#334155',
    textAlign: 'center',
  },
  tapHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  bottomActionWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  endMatchButton: {
    width: '100%',
  },
  labeledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
  },
  labeledButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    backgroundColor: '#9aa6b2',
  },
  labeledButtonInactive: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
});
