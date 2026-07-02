import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Button, ButtonText } from '../../components/ui/button';
import { Box, Divider, HStack, VStack } from '../../components/ui/box';
import { Heading, Text } from '../../components/ui/text';
import { Input, InputField } from '../../components/ui/input';
import { Pressable } from '../../components/ui/pressable';
import type { SetupForm } from '../appTypes';
import { SessionCodeBadge } from '../components/SessionCodeBadge';
import { SettingsModal } from './SettingsModal';

type View = 'landing' | 'create' | 'join';

type Props = {
  setup: SetupForm;
  sessionCode: string | null;
  onUpdateSetup: (updates: Partial<SetupForm>) => void;
  onStartMatch: () => void;
  onJoinSession: (code: string) => void;
  onCreateSession: () => void;
};

export function MobileSetupScreen({
  setup,
  sessionCode,
  onUpdateSetup,
  onStartMatch,
  onJoinSession,
  onCreateSession,
}: Props) {
  const [view, setView] = useState<View>('landing');
  const [playerInput, setPlayerInput] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  // Icon colours that can't use className
  const iconMuted = dark ? '#64748b' : '#94a3b8';
  const iconBack = dark ? '#e2e8f0' : '#111827';
  const iconGear = dark ? '#94a3b8' : '#64748b';

  useEffect(() => {
    if (sessionCode && view === 'landing') setView('create');
  }, [sessionCode]);

  const requiredPlayers = setup.mode === 'double' ? 4 : 2;
  const canStart = setup.players.length >= requiredPlayers;

  function addPlayer() {
    const name = playerInput.trim();
    if (!name) return;
    const capitalised = name.charAt(0).toUpperCase() + name.slice(1);
    if (setup.players.map(p => p.toLowerCase()).includes(capitalised.toLowerCase())) {
      setPlayerInput('');
      inputRef.current?.focus();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateSetup({ players: [...setup.players, capitalised] });
    setPlayerInput('');
    inputRef.current?.focus();
  }

  function removePlayer(name: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateSetup({ players: setup.players.filter(p => p !== name) });
  }

  function handleCreatePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreateSession();
    setView('create');
  }

  function handleStartMatch() {
    if (!canStart) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStartMatch();
  }

  // ── Landing ──────────────────────────────────────────────────────────────

  if (view === 'landing') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <StatusBar style={dark ? 'light' : 'dark'} />
        <VStack className="flex-1 px-6 pt-4 pb-8">

          {/* Gear button top-right */}
          <HStack className="justify-end">
            <Pressable
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSettings(true); }}
            >
              <Ionicons name="settings-outline" size={22} color={iconGear} />
            </Pressable>
          </HStack>

          {/* Hero */}
          <VStack className="flex-1 items-center justify-center gap-4">
            <Box className="w-28 h-28 rounded-[32px] bg-amber-100 dark:bg-amber-900/30 items-center justify-center mb-2">
              <Ionicons name="tennisball" size={56} color="#d97706" />
            </Box>
            <Heading size="3xl" className="tracking-tighter" style={{ fontSize: 48 }}>PoinYuk</Heading>
            <Text className="text-slate-500 dark:text-slate-400 text-xl">Catat skor tenis-mu</Text>
          </VStack>

          {/* Action cards */}
          <VStack className="gap-4">
            <Pressable
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm active:opacity-80"
              onPress={handleCreatePress}
            >
              <HStack className="px-5 py-6 gap-4 items-center">
                <Box className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 items-center justify-center">
                  <Ionicons name="add-circle-outline" size={30} color="#d97706" />
                </Box>
                <VStack className="flex-1 gap-1">
                  <Text className="text-xl font-extrabold">Mulai Pertandingan</Text>
                  <Text className="text-base text-slate-500 dark:text-slate-400">Buat sesi dan atur pemain</Text>
                </VStack>
                <Ionicons name="chevron-forward" size={22} color={iconMuted} />
              </HStack>
            </Pressable>

            <Pressable
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm active:opacity-80"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setView('join'); }}
            >
              <HStack className="px-5 py-6 gap-4 items-center">
                <Box className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 items-center justify-center">
                  <Ionicons name="enter-outline" size={30} color="#2563eb" />
                </Box>
                <VStack className="flex-1 gap-1">
                  <Text className="text-xl font-extrabold">Gabung Sesi</Text>
                  <Text className="text-base text-slate-500 dark:text-slate-400">Masukkan kode dari pemilik sesi</Text>
                </VStack>
                <Ionicons name="chevron-forward" size={22} color={iconMuted} />
              </HStack>
            </Pressable>
          </VStack>

        </VStack>

        <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      </SafeAreaView>
    );
  }

  // ── Join ─────────────────────────────────────────────────────────────────

  if (view === 'join') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <StatusBar style={dark ? 'light' : 'dark'} />
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-6" keyboardShouldPersistTaps="handled">

            <Pressable className="p-2 active:opacity-60" onPress={() => setView('landing')}>
              <Ionicons name="arrow-back" size={24} color={iconBack} />
            </Pressable>

            <VStack className="gap-1">
              <Text className="text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">Gabung Sesi</Text>
              <Text className="text-base text-slate-500 dark:text-slate-400">Masukkan kode 5 huruf dari pemilik sesi</Text>
            </VStack>

            <Input>
              <InputField
                autoFocus
                autoCapitalize="characters"
                maxLength={5}
                placeholder="A B C D E"
                value={joinCode}
                onChangeText={v => setJoinCode(v.toUpperCase())}
                onSubmitEditing={() => { if (joinCode.length === 5) onJoinSession(joinCode); }}
                className="text-3xl font-black tracking-[8px] text-center py-5"
              />
            </Input>

          </ScrollView>

          <Box className="px-5 pt-3 pb-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
            <Button
              action="secondary"
              size="xl"
              isDisabled={joinCode.length !== 5}
              className="w-full rounded-2xl bg-blue-600"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onJoinSession(joinCode); }}
            >
              <ButtonText className="text-white text-xl">Gabung →</ButtonText>
            </Button>
          </Box>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Create / Setup form ───────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <StatusBar style={dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          contentContainerClassName="px-5 pt-4 pb-6 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <HStack className="justify-between items-center">
            <Pressable className="p-2 active:opacity-60" onPress={() => setView('landing')}>
              <Ionicons name="arrow-back" size={24} color={iconBack} />
            </Pressable>
            <SessionCodeBadge sessionCode={sessionCode} />
          </HStack>

          {/* Players card */}
          <Box className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <HStack className="px-5 pt-5 pb-3 justify-between items-center">
              <Text className="text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">Pemain</Text>
              <Text className={`text-sm font-bold ${
                canStart ? 'text-teal-600 dark:text-teal-400'
                  : setup.players.length > 0 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {setup.players.length} / {requiredPlayers}
              </Text>
            </HStack>

            <Divider />

            <HStack className="px-5 py-4 gap-3 items-center">
              <Input className="flex-1 rounded-xl">
                <InputField
                  ref={inputRef as React.RefObject<any>}
                  placeholder="Nama pemain..."
                  value={playerInput}
                  onChangeText={setPlayerInput}
                  onSubmitEditing={addPlayer}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  style={{ fontSize: 18, paddingBottom: 8 }}
                />
              </Input>
              <Pressable
                className="w-14 h-14 rounded-xl bg-amber-600 items-center justify-center active:opacity-80"
                onPress={addPlayer}
              >
                <Ionicons name="add" size={26} color="#ffffff" />
              </Pressable>
            </HStack>

            {setup.players.length > 0 && (
              <>
                <Divider />
                <Box className="px-5 py-4 flex-row flex-wrap gap-2">
                  {setup.players.map(name => (
                    <Pressable
                      key={name}
                      className="flex-row items-center gap-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full px-4 py-2 active:opacity-70"
                      onPress={() => removePlayer(name)}
                    >
                      <Text style={{ fontSize: 17, fontWeight: '700' }}>{name}</Text>
                      <Ionicons name="close-circle" size={18} color={iconMuted} />
                    </Pressable>
                  ))}
                </Box>
              </>
            )}
          </Box>

          {/* Match type card */}
          <Box className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <Text className="px-5 pt-5 pb-3 text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
              Jenis Pertandingan
            </Text>
            <Divider />
            <HStack className="px-5 py-4 gap-3">
              {(['single', 'double'] as const).map(m => (
                <Pressable
                  key={m}
                  className={`flex-1 py-4 rounded-xl items-center border-2 active:opacity-80 ${
                    setup.mode === m
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-600'
                      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                  }`}
                  onPress={() => { Haptics.selectionAsync(); onUpdateSetup({ mode: m }); }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '800', color: setup.mode === m ? '#d97706' : (dark ? '#94a3b8' : '#64748b') }}>
                    {m === 'single' ? 'Single  1v1' : 'Double  2v2'}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </Box>

          {/* Deuce setting card */}
          <Box className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <HStack className="px-5 py-5 justify-between items-center gap-4">
              <VStack className="flex-1 gap-1">
                <Text style={{ fontSize: 17, fontWeight: '800' }}>Single Deuce + Sudden Death</Text>
                <Text style={{ fontSize: 15, color: dark ? '#94a3b8' : '#64748b' }}>Deuce kedua langsung menjadi sudden death</Text>
              </VStack>
              <Switch
                value={setup.singleDeuceSuddenDeath}
                onValueChange={v => { Haptics.selectionAsync(); onUpdateSetup({ singleDeuceSuddenDeath: v }); }}
                trackColor={{ false: dark ? '#475569' : '#cbd5e1', true: '#fcd34d' }}
                thumbColor={setup.singleDeuceSuddenDeath ? '#d97706' : (dark ? '#1e293b' : '#f8fafc')}
              />
            </HStack>
          </Box>

        </ScrollView>

        {/* Sticky bottom CTA */}
        <Box className="px-5 pt-3 pb-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 gap-2">
          {!canStart && setup.players.length > 0 && (
            <Text style={{ fontSize: 15, color: '#d97706', fontWeight: '600', textAlign: 'center' }}>
              Butuh {requiredPlayers - setup.players.length} pemain lagi untuk mode {setup.mode}
            </Text>
          )}
          <Button
            size="xl"
            isDisabled={!canStart}
            className="w-full rounded-2xl"
            onPress={handleStartMatch}
          >
            <ButtonText className="text-white text-xl">Lanjut ke Lineup →</ButtonText>
          </Button>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
