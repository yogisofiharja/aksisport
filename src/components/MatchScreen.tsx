import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'qrcode';
import { ComponentProps, useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TeamASide, TeamNames } from '../appTypes';
import { getPointLabel, MatchState, Team } from '../scoring';
import { Button, Card, DecorativeBackdrop } from './ui';

type MatchScreenProps = {
  matchState: MatchState;
  teamNames: TeamNames;
  teamASide: TeamASide;
  hasUndo: boolean;
  sessionCode: string | null;
  onAddPoint: (team: Team) => void;
  onUndo: () => void;
  onEndMatch: () => void;
  onShowHistory: () => void;
};

export function MatchScreen(props: MatchScreenProps) {
  const { matchState, teamNames, teamASide, hasUndo, sessionCode, onAddPoint, onUndo, onEndMatch, onShowHistory } = props;
  const [showUmpireModal, setShowUmpireModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionCode) return;
    const joinUrl = Platform.OS === 'web'
      ? `${window.location.origin}/?code=${sessionCode}`
      : `https://poinyuk.vercel.app/?code=${sessionCode}`;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 2, color: { dark: '#0f172a', light: '#f8fafc' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [sessionCode]);

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
            {sessionCode && (
              <Pressable onPress={() => setShowUmpireModal(true)} style={styles.umpireRow}>
                <Ionicons name="qr-code-outline" size={14} color="#b45309" />
                <Text style={styles.umpireCode}>Kode sesi: {sessionCode} — tap untuk QR</Text>
              </Pressable>
            )}
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

          <View style={styles.controlsRow}>
            <LabeledIconButton icon="arrow-undo" label="Batalkan" onPress={handleUndo} disabled={!hasUndo} />
            <LabeledIconButton icon="time-outline" label="Riwayat" onPress={onShowHistory} />
          </View>
        </ScrollView>

        <View style={styles.bottomActionWrap}>
          <Button label="Akhiri Match" onPress={handleEndMatch} style={styles.endMatchButton} />
        </View>
      </SafeAreaView>

      {/* Umpire QR modal */}
      <Modal
        visible={showUmpireModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUmpireModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowUmpireModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Bagikan Kode Sesi</Text>
            <Text style={styles.modalSub}>Scan QR atau ketik kode untuk bergabung ke sesi ini</Text>
            {qrDataUrl ? (
              <Image source={{ uri: qrDataUrl }} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder} />
            )}
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Kode</Text>
              <Text style={styles.codeValue}>{sessionCode}</Text>
            </View>
            <Pressable onPress={() => setShowUmpireModal(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Tutup</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    <Card tone="accent" style={styles.bannerCard}>
      <View style={styles.bannerTable}>
        <View style={styles.bannerHeaderRow}>
          <View style={styles.bannerNameCell} />
          <Text style={[styles.bannerColLabel, { width: 34 }]}>SET</Text>
          <Text style={[styles.bannerColLabel, { width: 34 }]}>GAME</Text>
          <Text style={[styles.bannerColLabel, { width: 52 }]}>POIN</Text>
        </View>
        <BannerRow name={props.leftName} set={props.leftSet} game={props.leftGame} point={props.leftPoint} isServing={props.leftIsServing} />
        <View style={styles.bannerDivider} />
        <BannerRow name={props.rightName} set={props.rightSet} game={props.rightGame} point={props.rightPoint} isServing={props.rightIsServing} />
      </View>
    </Card>
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
  return (
    <Pressable
      style={({ pressed }) => [
        styles.teamCard,
        props.tone === 'left' ? styles.teamCardLeft : styles.teamCardRight,
        props.isServing && styles.activeServerCard,
        pressed && styles.teamCardPressed,
      ]}
      onPress={props.onPress}
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
  );
}

function LabeledIconButton(props: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.labeledButton, props.disabled && styles.actionButtonDisabled]}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <Ionicons name={props.icon} size={18} color="#ffffff" />
      <Text style={styles.labeledButtonText}>{props.label}</Text>
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
  umpireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  umpireCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  bannerCard: {
    gap: 0,
    backgroundColor: '#f8f9ff',
    borderColor: '#c5d2ff',
  },
  bannerTable: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 8,
  },
  bannerColLabel: {
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(248,250,252,0.4)',
    letterSpacing: 0.8,
  },
  bannerTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
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
    width: 34,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  scoreCell: {
    width: 34,
    textAlign: 'center',
    color: '#fde047',
    fontSize: 18,
    fontWeight: '900',
  },
  pointCell: {
    width: 52,
    textAlign: 'center',
    color: '#f97316',
    fontSize: 18,
    fontWeight: '900',
  },
  scoreGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  teamCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    justifyContent: 'space-between',
  },
  teamCardLeft: {
    borderColor: '#f97316',
    backgroundColor: '#fff0db',
  },
  teamCardRight: {
    borderColor: '#fb7185',
    backgroundColor: '#ffe4ea',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  teamNameServeHighlight: {
    color: '#15803d',
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
    borderColor: '#2563eb',
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
    marginBottom: 12,
  },
  bottomActionWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: 'transparent',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 3,
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
