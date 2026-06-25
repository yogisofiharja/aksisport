import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, useRef } from 'react';
import { Alert, Animated, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TeamASide, TeamNames } from '../appTypes';
import { getPointLabel, MatchState, Team } from '../scoring';
import { Button, Card, DecorativeBackdrop } from './ui';
import { SessionCodeBadge } from './SessionCodeBadge';

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

  function handleEndMatch() {
    if (Platform.OS === 'web') {
      if (!window.confirm('Akhiri pertandingan?')) return;
      onEndMatch();
      return;
    }
    Alert.alert('Akhiri Match', 'Yakin ingin mengakhiri pertandingan?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Akhiri', style: 'destructive', onPress: onEndMatch },
    ]);
  }

  function handleUndo() {
    if (!hasUndo) return;
    onUndo();
  }

  const leftTeam: Team = teamASide === 'left' ? 'A' : 'B';
  const rightTeam: Team = leftTeam === 'A' ? 'B' : 'A';

  return (
    <DecorativeBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.matchContainer}>
          <Card tone="accent" style={styles.brandingCard}>
            <Text style={styles.brandingTitle}>PoinYuk</Text>
            <SessionCodeBadge sessionCode={sessionCode} />
          </Card>

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

          <View style={styles.scoreGrid}>
            <ScoreTapCard
              players={matchState.config.players.filter((player) => player.team === leftTeam).map((player) => player.name)}
              points={getPointLabel(matchState, leftTeam)}
              isServing={matchState.currentServerPlayerId.startsWith(leftTeam)}
              serverPlayerName={matchState.config.players.find((p) => p.id === matchState.currentServerPlayerId && p.team === leftTeam)?.name}
              onPress={() => onAddPoint(leftTeam)}
              tone="left"
            />

            <ScoreTapCard
              players={matchState.config.players.filter((player) => player.team === rightTeam).map((player) => player.name)}
              points={getPointLabel(matchState, rightTeam)}
              isServing={matchState.currentServerPlayerId.startsWith(rightTeam)}
              serverPlayerName={matchState.config.players.find((p) => p.id === matchState.currentServerPlayerId && p.team === rightTeam)?.name}
              onPress={() => onAddPoint(rightTeam)}
              tone="right"
            />
          </View>

        </ScrollView>

        <View style={styles.bottomActionWrap}>
          <View style={styles.controlsRow}>
            <LabeledIconButton icon="backspace-outline" onPress={handleUndo} disabled={!hasUndo} />
            <LabeledIconButton
              icon={voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
              onPress={onToggleVoice}
              active={voiceEnabled}
            />
          </View>
          <Button label="Akhiri Match" onPress={handleEndMatch} style={styles.endMatchButton} />
        </View>
      </SafeAreaView>

    </DecorativeBackdrop>
  );
}

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
  brandingCard: { paddingVertical: 14, gap: 6 },
  brandingTitle: { fontSize: 28, fontWeight: '900', color: '#111827' },
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
