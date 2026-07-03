import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LineupResult } from '../appTypes';
import { MatchMode } from '../scoring';
import { Button, Card, DecorativeBackdrop } from './ui';
import { SessionCodeBadge } from './SessionCodeBadge';
import { useTranslation } from '../i18n';

export type { LineupResult };

type LineupScreenProps = {
  players: string[];
  mode: MatchMode;
  playerPlayCounts: Record<string, number>;
  sessionCode?: string | null;
  onConfirm: (result: LineupResult) => void;
  onBack: () => void;
};

const LEFT_COLORS = { bg: '#dbeafe', border: '#2563eb', text: '#1e40af', badge: '#3b82f6' };
const RIGHT_COLORS = { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', badge: '#ef4444' };

export function LineupScreen({ players, mode, playerPlayCounts, sessionCode, onConfirm, onBack }: LineupScreenProps) {
  const { t } = useTranslation();
  const perTeam = mode === 'double' ? 2 : 1;
  const maxAssigned = perTeam * 2;

  const [assignedOrder, setAssignedOrder] = useState<string[]>([]);
  const [firstServerName, setFirstServerName] = useState<string | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [animatedServer, setAnimatedServer] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  const randInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const randTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftCardAnim = useRef(new Animated.Value(0)).current;
  const rightCardAnim = useRef(new Animated.Value(0)).current;
  const labelAnim = useRef(new Animated.Value(1)).current;
  const cardWidthRef = useRef(0);

  const isFull = assignedOrder.length === maxAssigned;

  // Left team fills first, right fills next.
  const leftAssigned = assignedOrder.slice(0, perTeam);
  const rightAssigned = assignedOrder.slice(perTeam, maxAssigned);
  const allAssigned = [...leftAssigned, ...rightAssigned];

  const teamANames = leftAssigned;
  const teamBNames = rightAssigned;

  useEffect(() => {
    if (firstServerName && !allAssigned.includes(firstServerName)) {
      setFirstServerName(null);
    }
  }, [allAssigned.join(','), firstServerName]);

  useEffect(() => {
    return () => {
      if (randInterval.current) clearInterval(randInterval.current);
      if (randTimeout.current) clearTimeout(randTimeout.current);
    };
  }, []);

  function handlePlayerTap(name: string) {
    if (assignedOrder.includes(name)) {
      setAssignedOrder((prev) => prev.filter((p) => p !== name));
      return;
    }
    if (isFull) return;
    setAssignedOrder((prev) => [...prev, name]);
  }

  function handleSwap() {
    if (isSwapping) return;
    setIsSwapping(true);
    const w = cardWidthRef.current + 12;
    Animated.parallel([
      Animated.timing(leftCardAnim, { toValue: w, duration: 300, useNativeDriver: true }),
      Animated.timing(rightCardAnim, { toValue: -w, duration: 300, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(labelAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
        Animated.timing(labelAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setAssignedOrder(prev => [...prev.slice(perTeam), ...prev.slice(0, perTeam)]);
      leftCardAnim.setValue(0);
      rightCardAnim.setValue(0);
      setIsSwapping(false);
    });
  }

  function handleRandomServer() {
    if (!isFull || isRandomizing) return;
    setIsRandomizing(true);
    let cursor = 0;
    randInterval.current = setInterval(() => {
      setAnimatedServer(serverCandidates[cursor % serverCandidates.length]);
      cursor++;
    }, 90);
    randTimeout.current = setTimeout(() => {
      if (randInterval.current) clearInterval(randInterval.current);
      const winner = serverCandidates[Math.floor(Math.random() * serverCandidates.length)];
      setAnimatedServer(winner);
      setFirstServerName(winner);
      setIsRandomizing(false);
      setTimeout(() => setAnimatedServer(null), 400);
    }, 1200);
  }

  function handleConfirm() {
    if (!isFull || !firstServerName) return;
    onConfirm({
      teamANames,
      teamBNames,
      firstServerName,
      teamASide: 'left',
    });
  }

  const effectiveServer = animatedServer ?? firstServerName;
  const canConfirm = isFull && Boolean(firstServerName);

  // Returns which side ('left' | 'right' | null) this player is on.
  function getPlayerSide(name: string): 'left' | 'right' | null {
    const idx = assignedOrder.indexOf(name);
    if (idx === -1) return null;
    return idx < perTeam ? 'left' : 'right';
  }

  const sortedPlayers = [...players].sort((a, b) => {
    const diff = (playerPlayCounts[a] ?? 0) - (playerPlayCounts[b] ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  const serverCandidates = sortedPlayers.filter(name => assignedOrder.includes(name));

  return (
    <DecorativeBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Card tone="accent" style={styles.heroCard}>
            <Text style={styles.heroTitle}>PoinYuk</Text>
            <SessionCodeBadge sessionCode={sessionCode ?? null} />
          </Card>

          {/* All players pool */}
          <Card>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('pickPlayers')}</Text>
            </View>
            <View style={styles.playerGrid}>
              {sortedPlayers.map((name) => {
                const side = getPlayerSide(name);
                const colors = side === 'left' ? LEFT_COLORS : side === 'right' ? RIGHT_COLORS : null;
                const playCount = playerPlayCounts[name];
                return (
                  <Pressable
                    key={name}
                    onPress={() => handlePlayerTap(name)}
                    style={({ pressed }) => [
                      styles.playerPill,
                      colors
                        ? { backgroundColor: colors.bg, borderColor: colors.border }
                        : styles.playerPillDefault,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.playerPillName, colors && { color: colors.text }]}>{name}</Text>
                    {playCount > 0 && (
                      <View style={[styles.playCountBadge, colors && { backgroundColor: colors.badge }]}>
                        <Text style={styles.playCountBadgeText}>{playCount}x</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Side labels — pulse on swap */}
          <Animated.View style={[styles.labelsRow, { opacity: labelAnim }]}>
            <View style={[styles.sideLabelBox, { backgroundColor: LEFT_COLORS.bg, borderColor: LEFT_COLORS.border }]}>
              <Text style={[styles.sideLabelText, { color: LEFT_COLORS.text }]}>KIRI</Text>
            </View>
            <View style={[styles.sideLabelBox, { backgroundColor: RIGHT_COLORS.bg, borderColor: RIGHT_COLORS.border }]}>
              <Text style={[styles.sideLabelText, { color: RIGHT_COLORS.text }]}>KANAN</Text>
            </View>
          </Animated.View>

          {/* Player name boxes — animate on swap */}
          <View style={styles.playersRow}>
            <Animated.View
              style={[styles.playersCardWrapper, { transform: [{ translateX: leftCardAnim }], zIndex: isSwapping ? 2 : 1 }]}
              onLayout={(e) => { cardWidthRef.current = e.nativeEvent.layout.width; }}
            >
              <PlayerSlot
                players={leftAssigned}
                emptySlots={perTeam - leftAssigned.length}
                colors={LEFT_COLORS}
              />
            </Animated.View>
            <Animated.View
              style={[styles.playersCardWrapper, { transform: [{ translateX: rightCardAnim }], zIndex: 1 }]}
            >
              <PlayerSlot
                players={rightAssigned}
                emptySlots={perTeam - rightAssigned.length}
                colors={RIGHT_COLORS}
              />
            </Animated.View>
          </View>

          {/* Switch side */}
          <Pressable
            style={({ pressed }) => [styles.switchSideBtn, pressed && styles.pressed]}
            onPress={handleSwap}
            disabled={isSwapping}
          >
            <Text style={styles.switchSideText}>⇄  Tukar Tempat</Text>
          </Pressable>

          {/* Server selection — fades in once all slots are filled */}
          {isFull && (
            <FadeInCard>
              <Text style={styles.sectionTitle}>Server Pertama</Text>
              <View style={styles.serverRow}>
                {serverCandidates.map((name) => {
                  const isSelected = effectiveServer === name;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => setFirstServerName(name)}
                      style={[styles.serverPill, isSelected && styles.serverPillActive]}
                    >
                      <Text style={[styles.serverPillText, isSelected && styles.serverPillTextActive]}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button
                label={isRandomizing ? 'Mengacak...' : 'Acak Server 🎲'}
                variant="secondary"
                onPress={handleRandomServer}
                disabled={isRandomizing}
              />
            </FadeInCard>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <View style={styles.flexButton}>
              <Button label={`← ${t('back')}`} onPress={onBack} variant="outline" />
            </View>
            <View style={styles.flexButton}>
              <Button label={t('continueBtn')} onPress={handleConfirm} disabled={!canConfirm} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </DecorativeBackdrop>
  );
}

function PlayerSlot({
  players,
  emptySlots,
  colors,
}: {
  players: string[];
  emptySlots: number;
  colors: { bg: string; border: string; text: string };
}) {
  return (
    <View style={[styles.playerCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {players.map((name) => (
        <Text key={name} style={[styles.slotPlayer, { color: colors.text }]}>
          {name}
        </Text>
      ))}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <Text key={`empty-${i}`} style={styles.slotEmpty}>
          —
        </Text>
      ))}
    </View>
  );
}

function FadeInCard({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Card>{children}</Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32, gap: 14 },

  heroCard: { gap: 6, paddingVertical: 14 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#111827' },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#b45309',
    textTransform: 'uppercase',
  },
  heroSub: { fontSize: 13, lineHeight: 20, color: '#4b5563' },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: 1 },

  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  playerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  playerPillDefault: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  playerPillName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  playCountBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
  },
  playCountBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },

  labelsRow: { flexDirection: 'row', gap: 12 },
  sideLabelBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sideLabelText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playersRow: { flexDirection: 'row', gap: 12, overflow: 'visible' },
  playersCardWrapper: { flex: 1 },
  playerCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    gap: 8,
    alignItems: 'center',
    minHeight: 70,
  },
  slotPlayer: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  slotEmpty: {
    fontSize: 20,
    color: '#cbd5e1',
    textAlign: 'center',
  },

  switchSideBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  switchSideText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d4ed8',
  },

  serverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  serverPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  serverPillActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  serverPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  serverPillTextActive: {
    color: '#ffffff',
  },

  actionRow: { flexDirection: 'row', gap: 10 },
  flexButton: { flex: 1 },

  pressed: { opacity: 0.75 },
});
