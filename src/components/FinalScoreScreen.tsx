import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TeamNames } from '../appTypes';
import { MatchState, Team } from '../scoring';
import { Button, Card, DecorativeBackdrop } from './ui';
import { ShareCardModal } from './ShareCardModal';
import { SessionCodeBadge } from './SessionCodeBadge';

type FinalScoreScreenProps = {
  matchState: MatchState;
  teamNames: TeamNames;
  sharePreviewDataUrl: string | null;
  sessionCode: string | null;
  onShare: () => void;
  onShareFromPreview: () => void;
  onCloseSharePreview: () => void;
  onChangeBackground: (source: 'gallery' | 'camera') => void;
  onBackToSetup: () => void;
  onClearSavedState: () => void;
  onShowHistory: () => void;
};

export function FinalScoreScreen(props: FinalScoreScreenProps) {
  const {
    matchState,
    teamNames,
    sharePreviewDataUrl,
    sessionCode,
    onShare,
    onShareFromPreview,
    onCloseSharePreview,
    onChangeBackground,
    onBackToSetup,
    onClearSavedState,
    onShowHistory,
  } = props;

  const winner = matchState.winner;
  const completedSets = matchState.completedSets ?? [];

  function handleEndSession() {
    if (!window.confirm('Akhiri sesi? Semua data tersimpan akan dihapus.')) return;
    onClearSavedState();
  }

  return (
    <DecorativeBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.sessionHeader}>
            <SessionCodeBadge sessionCode={sessionCode} />
          </View>

          <Card style={styles.scoreboardCard}>
            <TVScoreboard
              teamAName={teamNames.A}
              teamBName={teamNames.B}
              sets={matchState.sets}
              completedSets={completedSets}
              currentGames={matchState.games}
              winner={winner}
            />
          </Card>

          <Button label="Bagikan" onPress={onShare} size="lg" />
          <Button label="Match Baru →" onPress={onBackToSetup} size="lg" variant="outline" />

          <Pressable onPress={onShowHistory} style={styles.riwayatLink}>
            <Text style={styles.riwayatText}>Lihat Riwayat</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.stickyFooter}>
          <Pressable onPress={handleEndSession} style={styles.endSessionBtn}>
            <Text style={styles.endSessionText}>Akhiri Sesi</Text>
          </Pressable>
        </View>

        <ShareCardModal
          visible={!!sharePreviewDataUrl}
          imageDataUrl={sharePreviewDataUrl}
          onShare={onShareFromPreview}
          onChangeBackground={onChangeBackground}
          onClose={onCloseSharePreview}
        />
      </SafeAreaView>
    </DecorativeBackdrop>
  );
}

function TVScoreboard({
  teamAName,
  teamBName,
  sets,
  completedSets,
  currentGames,
  winner,
}: {
  teamAName: string;
  teamBName: string;
  sets: { A: number; B: number };
  completedSets: Array<{ A: number; B: number }>;
  currentGames: { A: number; B: number };
  winner: Team | null;
}) {
  const hasOngoingGame = currentGames.A > 0 || currentGames.B > 0;
  const showFallback = completedSets.length === 0 && !hasOngoingGame;
  const showSetTotal = completedSets.length > 0;

  return (
    <View style={styles.scoreboard}>
      <TVRow
        name={teamAName}
        team="A"
        setTotal={sets.A}
        completedSets={completedSets}
        currentGames={currentGames}
        isWinner={winner === 'A'}
        hasOngoingGame={hasOngoingGame}
        showFallback={showFallback}
        showSetTotal={showSetTotal}
      />
      <View style={styles.scoreboardDivider} />
      <TVRow
        name={teamBName}
        team="B"
        setTotal={sets.B}
        completedSets={completedSets}
        currentGames={currentGames}
        isWinner={winner === 'B'}
        hasOngoingGame={hasOngoingGame}
        showFallback={showFallback}
        showSetTotal={showSetTotal}
      />
    </View>
  );
}

function TVRow({
  name,
  team,
  setTotal,
  completedSets,
  currentGames,
  isWinner,
  hasOngoingGame,
  showFallback,
  showSetTotal,
}: {
  name: string;
  team: Team;
  setTotal: number;
  completedSets: Array<{ A: number; B: number }>;
  currentGames: { A: number; B: number };
  isWinner: boolean;
  hasOngoingGame: boolean;
  showFallback: boolean;
  showSetTotal: boolean;
}) {
  const other: Team = team === 'A' ? 'B' : 'A';

  return (
    <View style={styles.tvRow}>
      <Text style={[styles.tvName, isWinner && styles.tvNameWinner]} numberOfLines={1}>
        {name}
      </Text>

      {showFallback && (
        <Text style={[styles.tvScore, styles.tvScoreLost]}>0</Text>
      )}

      {showSetTotal && (
        <>
          <Text style={[styles.tvSetTotal, isWinner && styles.tvSetTotalWinner]}>
            {setTotal}
          </Text>
          <View style={styles.tvVerticalDivider} />
        </>
      )}

      {completedSets.map((set, i) => {
        const wonSet = set[team] > set[other];
        return (
          <Text key={i} style={[styles.tvScore, wonSet ? styles.tvScoreWon : styles.tvScoreLost]}>
            {set[team]}
          </Text>
        );
      })}

      {hasOngoingGame && (
        <Text style={[styles.tvScore, styles.tvScorePartial]}>
          {currentGames[team]}
        </Text>
      )}
    </View>
  );
}

// ── Web styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  sessionHeader: { alignItems: 'flex-end' },
  scoreboardCard: {
    padding: 0,
    overflow: 'hidden',
  },
  scoreboard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  scoreboardDivider: {
    height: 1,
    backgroundColor: '#334155',
  },
  tvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    gap: 4,
  },
  tvSetTotal: {
    width: 28,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#475569',
  },
  tvSetTotalWinner: { color: '#d97706' },
  tvVerticalDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#334155',
    marginHorizontal: 6,
  },
  tvName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 10,
  },
  tvNameWinner: { color: '#f8fafc', fontWeight: '900' },
  tvScore: {
    width: 36,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
  },
  tvScoreWon: { color: '#f8fafc' },
  tvScoreLost: { color: '#475569' },
  tvScorePartial: { color: '#fde047' },
  riwayatLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  riwayatText: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  stickyFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  endSessionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  endSessionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
});
