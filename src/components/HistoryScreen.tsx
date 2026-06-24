import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MatchRecord } from '../appTypes';
import {
  composeShareCardDataUrlWeb,
  downloadDataUrlWeb,
  pickImageDataUrlWeb,
  shareImageWeb,
} from '../shareCard';
import { Button, Card, DecorativeBackdrop } from './ui';
import { ShareCardModal } from './ShareCardModal';

type HistoryScreenProps = {
  matchHistory: MatchRecord[];
  onBack: () => void;
};

export function HistoryScreen({ matchHistory, onBack }: HistoryScreenProps) {
  const [sharePreviewDataUrl, setSharePreviewDataUrl] = useState<string | null>(null);
  const [sharingRecord, setSharingRecord] = useState<MatchRecord | null>(null);
  const [backgroundDataUrl, setBackgroundDataUrl] = useState<string | null>(null);

  async function handleShare(record: MatchRecord) {
    if (Platform.OS !== 'web') return;
    setSharingRecord(record);
    setBackgroundDataUrl(null);
    const dataUrl = await buildShareCard(record, undefined);
    if (dataUrl) setSharePreviewDataUrl(dataUrl);
  }

  async function handleChangeBackground() {
    if (!sharingRecord) return;
    const picked = await pickImageDataUrlWeb('gallery');
    if (!picked) return;
    setBackgroundDataUrl(picked);
    const dataUrl = await buildShareCard(sharingRecord, picked);
    if (dataUrl) setSharePreviewDataUrl(dataUrl);
  }

  async function handleShareFromPreview() {
    if (!sharePreviewDataUrl || !sharingRecord) return;
    const teamALabel = sharingRecord.teams.A.join(' / ');
    const teamBLabel = sharingRecord.teams.B.join(' / ');
    const hasSets = sharingRecord.sets.A > 0 || sharingRecord.sets.B > 0;
    const scoreText = hasSets
      ? `Set ${sharingRecord.sets.A}-${sharingRecord.sets.B}`
      : `${sharingRecord.games.A}-${sharingRecord.games.B}`;
    const shareText = `${teamALabel} vs ${teamBLabel}\n${scoreText}`;
    const shared = await shareImageWeb(sharePreviewDataUrl, shareText);
    if (shared) closeSharePreview();
    else downloadDataUrlWeb(sharePreviewDataUrl, 'poinyuk-score.png');
  }

  function closeSharePreview() {
    setSharePreviewDataUrl(null);
    setSharingRecord(null);
    setBackgroundDataUrl(null);
  }

  return (
    <DecorativeBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable onPress={onBack} style={styles.backRow}>
            <Ionicons name="arrow-back" size={18} color="#64748b" />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <Card tone="accent" style={styles.heroCard}>
            <Text style={styles.appTitle}>PoinYuk</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Riwayat Pertandingan</Text>
            {matchHistory.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={40} color="#cbd5e1" />
                <Text style={styles.emptyText}>Belum ada pertandingan tercatat.</Text>
                <Text style={styles.emptySub}>Selesaikan pertandingan agar muncul di sini.</Text>
              </View>
            )}
          </Card>

          {matchHistory.map((record) => (
            <MatchCard key={record.id} record={record} onShare={() => handleShare(record)} />
          ))}

          <Button label="Kembali" onPress={onBack} variant="outline" />
        </ScrollView>

        <ShareCardModal
          visible={!!sharePreviewDataUrl}
          imageDataUrl={sharePreviewDataUrl}
          onShare={handleShareFromPreview}
          onChangeBackground={handleChangeBackground}
          onClose={closeSharePreview}
        />
      </SafeAreaView>
    </DecorativeBackdrop>
  );
}

async function buildShareCard(record: MatchRecord, bg: string | undefined): Promise<string | null> {
  const hasSets = record.sets.A > 0 || record.sets.B > 0;
  const mainScore = hasSets
    ? `${record.sets.A} - ${record.sets.B}`
    : `${record.games.A} - ${record.games.B}`;
  const setBreakdown = hasSets
    ? record.completedSets.map((s) => `${s.A}–${s.B}`).join('  ·  ')
    : undefined;
  try {
    return await composeShareCardDataUrlWeb({
      backgroundDataUrl: bg,
      title: '',
      matchup: `${record.teams.A.join(' / ')} vs ${record.teams.B.join(' / ')}`,
      gameScore: mainScore,
      setBreakdown,
    });
  } catch {
    return null;
  }
}

function MatchCard({ record, onShare }: { record: MatchRecord; onShare: () => void }) {
  const hasSets = record.sets.A > 0 || record.sets.B > 0;
  const headlineA = hasSets ? record.sets.A : record.games.A;
  const headlineB = hasSets ? record.sets.B : record.games.B;
  const breakdown = hasSets
    ? record.completedSets.map((s) => `${s.A}–${s.B}`).join('  ·  ')
    : null;

  const teamALabel = record.teams.A.join(' / ');
  const teamBLabel = record.teams.B.join(' / ');

  const winnerLabel =
    record.winner === 'A'
      ? teamALabel
      : record.winner === 'B'
        ? teamBLabel
        : null;

  const date = new Date(record.completedAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card style={styles.matchCard}>
      {/* Teams */}
      <View style={styles.teamsRow}>
        <Text style={[styles.teamName, styles.teamLeft]} numberOfLines={2}>{teamALabel}</Text>
        <Text style={styles.vsText}>vs</Text>
        <Text style={[styles.teamName, styles.teamRight]} numberOfLines={2}>{teamBLabel}</Text>
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreNum, record.winner === 'A' && styles.scoreWinner]}>{headlineA}</Text>
        <Text style={styles.scoreDash}>—</Text>
        <Text style={[styles.scoreNum, record.winner === 'B' && styles.scoreWinner]}>{headlineB}</Text>
      </View>

      {hasSets && <Text style={styles.scoreLabel}>SET</Text>}
      {breakdown && <Text style={styles.breakdown}>{breakdown}</Text>}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {winnerLabel ? (
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy" size={13} color="#d97706" />
              <Text style={styles.winnerText}>{winnerLabel} Menang</Text>
            </View>
          ) : (
            <Text style={styles.winnerText}>Tidak ada pemenang</Text>
          )}
          <Text style={styles.dateText}>{date}</Text>
        </View>

        {Platform.OS === 'web' && (
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
            onPress={onShare}
          >
            <Ionicons name="share-outline" size={16} color="#f97316" />
            <Text style={styles.shareBtnText}>Bagikan</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  heroCard: { paddingVertical: 16 },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  matchCard: {
    gap: 8,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  teamLeft: { textAlign: 'left' },
  teamRight: { textAlign: 'right' },
  vsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 2,
  },
  scoreNum: {
    fontSize: 40,
    fontWeight: '900',
    color: '#334155',
    minWidth: 36,
    textAlign: 'center',
  },
  scoreWinner: {
    color: '#d97706',
  },
  scoreDash: {
    fontSize: 28,
    fontWeight: '900',
    color: '#cbd5e1',
  },
  scoreLabel: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginTop: -6,
  },
  breakdown: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 2,
  },
  footerLeft: {
    gap: 4,
    flex: 1,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  winnerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  shareBtnPressed: {
    opacity: 0.75,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
  },
});
