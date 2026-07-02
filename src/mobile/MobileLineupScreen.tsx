import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, TouchableOpacity, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, HStack, VStack } from '../../components/ui/box';
import { Text, Heading } from '../../components/ui/text';
import type { LineupResult } from '../appTypes';
import type { MatchMode } from '../scoring';
import { SessionCodeBadge } from '../components/SessionCodeBadge';

type Props = {
  players: string[];
  mode: MatchMode;
  playerPlayCounts: Record<string, number>;
  sessionCode?: string | null;
  onConfirm: (result: LineupResult) => void;
  onBack: () => void;
};

const LEFT = { bg: '#dbeafe', darkBg: '#1e3a5f', border: '#2563eb', text: '#1e40af', darkText: '#93c5fd', badge: '#3b82f6' };
const RIGHT = { bg: '#fee2e2', darkBg: '#5f1e1e', border: '#dc2626', text: '#991b1b', darkText: '#fca5a5', badge: '#ef4444' };

export function MobileLineupScreen({ players, mode, playerPlayCounts, sessionCode, onConfirm, onBack }: Props) {
  const perTeam = mode === 'double' ? 2 : 1;
  const maxAssigned = perTeam * 2;
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  const [assignedOrder, setAssignedOrder] = useState<string[]>([]);
  const [firstServerName, setFirstServerName] = useState<string | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [animatedServer, setAnimatedServer] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  const randInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const randTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameOpacity = useRef(new Animated.Value(1)).current;

  const isFull = assignedOrder.length === maxAssigned;
  const leftAssigned = assignedOrder.slice(0, perTeam);
  const rightAssigned = assignedOrder.slice(perTeam, maxAssigned);
  const allAssigned = [...leftAssigned, ...rightAssigned];

  const sortedPlayers = [...players].sort((a, b) => {
    const diff = (playerPlayCounts[a] ?? 0) - (playerPlayCounts[b] ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  const serverCandidates = sortedPlayers.filter(n => allAssigned.includes(n));
  const effectiveServer = animatedServer ?? firstServerName;
  const canConfirm = isFull && Boolean(firstServerName);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  useEffect(() => {
    if (firstServerName && !allAssigned.includes(firstServerName)) setFirstServerName(null);
  }, [allAssigned.join(','), firstServerName]);

  useEffect(() => () => {
    if (randInterval.current) clearInterval(randInterval.current);
    if (randTimeout.current) clearTimeout(randTimeout.current);
  }, []);

  function getPlayerSide(name: string): 'left' | 'right' | null {
    const idx = assignedOrder.indexOf(name);
    if (idx === -1) return null;
    return idx < perTeam ? 'left' : 'right';
  }

  function handlePlayerTap(name: string) {
    if (assignedOrder.includes(name)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAssignedOrder(prev => prev.filter(p => p !== name));
      return;
    }
    if (isFull) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAssignedOrder(prev => [...prev, name]);
  }

  function handleSwap() {
    if (isSwapping) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSwapping(true);
    Animated.timing(nameOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setAssignedOrder(prev => [...prev.slice(perTeam), ...prev.slice(0, perTeam)]);
      Animated.timing(nameOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        setIsSwapping(false);
      });
    });
  }

  function handleRandomServer() {
    if (!isFull || isRandomizing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setAnimatedServer(null), 400);
    }, 1200);
  }

  function handleConfirm() {
    if (!canConfirm) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm({ teamANames: leftAssigned, teamBNames: rightAssigned, firstServerName: firstServerName!, teamASide: 'left' });
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <HStack className="justify-between items-center">
          <Pressable
            className="p-2 active:opacity-60"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }}
          >
            <Ionicons name="arrow-back" size={24} color={dark ? '#e2e8f0' : '#111827'} />
          </Pressable>
          <SessionCodeBadge sessionCode={sessionCode ?? null} />
        </HStack>

        <Heading size="3xl">Pilih Pemain</Heading>

        {/* Player pool */}
        <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <Text className="text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase px-1 mb-3">
            Ketuk untuk pilih
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {sortedPlayers.map(name => {
              const side = getPlayerSide(name);
              const C = side === 'left' ? LEFT : side === 'right' ? RIGHT : null;
              const playCount = playerPlayCounts[name] ?? 0;
              return (
                <TouchableOpacity
                  key={name}
                  activeOpacity={0.75}
                  onPress={() => handlePlayerTap(name)}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5 },
                    C
                      ? { backgroundColor: C.badge, borderColor: C.badge }
                      : { backgroundColor: dark ? '#334155' : '#f1f5f9', borderColor: dark ? '#475569' : '#cbd5e1' },
                  ]}
                >
                  <Text
                    style={{ fontSize: 17, fontWeight: '700', color: C ? '#fff' : (dark ? '#e2e8f0' : '#374151') }}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {playCount > 0 && (
                    <View style={[
                      { minWidth: 28, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, alignItems: 'center' as const },
                      { backgroundColor: C ? 'rgba(255,255,255,0.25)' : (dark ? '#475569' : '#cbd5e1') },
                    ]}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: C ? '#fff' : (dark ? '#e2e8f0' : '#374151') }}>{playCount}x</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Team slots */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PlayerSlot label="KIRI" nameOpacity={nameOpacity} players={leftAssigned} emptySlots={perTeam - leftAssigned.length} C={LEFT} dark={dark} />
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSwap}
            disabled={isSwapping}
            className="w-[42px] h-[42px] rounded-full bg-blue-700 items-center justify-center"
          >
            <Ionicons name="swap-horizontal" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <PlayerSlot label="KANAN" nameOpacity={nameOpacity} players={rightAssigned} emptySlots={perTeam - rightAssigned.length} C={RIGHT} dark={dark} />
          </View>
        </View>

        {/* Server selection */}
        {isFull && (
          <FadeInBox>
            <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <Text style={{ fontSize: 17, fontWeight: '800', marginBottom: 12 }}>Server Pertama</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
                {serverCandidates.map(name => {
                  const active = effectiveServer === name;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => { Haptics.selectionAsync(); setFirstServerName(name); }}
                      style={[
                        { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5 },
                        active
                          ? { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' }
                          : { backgroundColor: dark ? '#334155' : '#f1f5f9', borderColor: dark ? '#475569' : '#cbd5e1' },
                      ]}
                    >
                      <Text style={{ fontSize: 17, fontWeight: '700', color: active ? '#fff' : (dark ? '#e2e8f0' : '#374151') }}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={isRandomizing}
                onPress={handleRandomServer}
                className={`mt-2 bg-blue-700 rounded-[14px] py-3.5 items-center justify-center ${isRandomizing ? 'opacity-50' : ''}`}
              >
                <Text className="text-[17px] font-extrabold text-white tracking-wide">
                  {isRandomizing ? '🎲  Mengacak...' : '🎲  Acak Server'}
                </Text>
              </TouchableOpacity>
            </View>
          </FadeInBox>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          activeOpacity={canConfirm ? 0.75 : 1}
          onPress={handleConfirm}
          disabled={!canConfirm}
          className={`py-[17px] rounded-2xl items-center justify-center bg-amber-600 ${!canConfirm ? 'opacity-45' : ''}`}
        >
          <Text className="text-[20px] font-extrabold text-white">Lanjut →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerSlot({ label, nameOpacity, players, emptySlots, C, dark }: {
  label: string; nameOpacity: Animated.Value; players: string[]; emptySlots: number; C: typeof LEFT; dark: boolean;
}) {
  return (
    <View style={{ borderRadius: 14, borderWidth: 2, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, height: 130, backgroundColor: dark ? C.darkBg : C.bg, borderColor: C.border }}>
      <Text style={{ fontSize: 13, fontWeight: '900', letterSpacing: 1.5, alignSelf: 'flex-start', color: dark ? C.darkText : C.text }}>{label}</Text>
      <Animated.View style={{ flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: 10, opacity: nameOpacity }}>
        {players.map(name => (
          <Text key={name} style={{ fontSize: 18, fontWeight: '800', textAlign: 'center', color: dark ? '#f1f5f9' : '#1e293b' }} numberOfLines={1}>
            {name}
          </Text>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <Text key={i} style={{ fontSize: 22, color: dark ? '#475569' : '#cbd5e1', textAlign: 'center' }}>—</Text>
        ))}
      </Animated.View>
    </View>
  );
}

function FadeInBox({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
