import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SetupForm } from '../appTypes';
import { Button, Card, DecorativeBackdrop, palette, Pill } from './ui';
import { SessionCodeBadge } from './SessionCodeBadge';

type SetupView = 'landing' | 'create' | 'join';

type MatchSetupProps = {
  setup: SetupForm;
  sessionCode: string | null;
  onUpdateSetup: (updates: Partial<SetupForm>) => void;
  onStartMatch: () => void;
  onJoinSession: (code: string) => void;
  onCreateSession: () => void;
};

export function MatchSetup({
  setup,
  sessionCode,
  onUpdateSetup,
  onStartMatch,
  onJoinSession,
  onCreateSession,
}: MatchSetupProps) {
  const [view, setView] = useState<SetupView>('landing');
  const [inputValue, setInputValue] = useState('');
  // Auto-advance to form when a session code arrives (owner created session or umpire joined)
  useEffect(() => {
    if (sessionCode && view === 'landing') setView('create');
  }, [sessionCode]);

  const inputRef = useRef<TextInput>(null);
  const [joinCode, setJoinCode] = useState('');

  const requiredPlayers = setup.mode === 'double' ? 4 : 2;
  const canStart = setup.players.length >= requiredPlayers;
  const playerCountColor =
    setup.players.length >= requiredPlayers ? '#0f766e' : setup.players.length > 0 ? '#b45309' : '#9ca3af';

  function addPlayer() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (setup.players.map((name) => name.toLowerCase()).includes(capitalised.toLowerCase())) {
      setInputValue('');
      inputRef.current?.focus();
      return;
    }
    onUpdateSetup({ players: [...setup.players, capitalised] });
    setInputValue('');
    inputRef.current?.focus();
  }

  function removePlayer(name: string) {
    onUpdateSetup({ players: setup.players.filter((player) => player !== name) });
  }

  function handleCreatePress() {
    onCreateSession();
    setView('create');
  }

  // ── Landing ───────────────────────────────────────────────────────────────

  if (view === 'landing') {
    return (
      <DecorativeBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.landingContainer}>
            <Card tone="accent" style={styles.heroCard}>
              <Text style={styles.appTitle}>PoinYuk</Text>
            </Card>

            <Card style={styles.landingCard}>
              <Pressable style={({ pressed }) => [styles.entryButton, pressed && styles.entryButtonPressed]} onPress={handleCreatePress}>
                <View style={styles.entryIcon}>
                  <Ionicons name="add-circle-outline" size={28} color="#d97706" />
                </View>
                <View style={styles.entryText}>
                  <Text style={styles.entryTitle}>Mulai Pertandingan</Text>
                  <Text style={styles.entrySub}>Buat sesi dan atur pemain</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </Pressable>

              <View style={styles.entrySeparator} />

              <Pressable style={({ pressed }) => [styles.entryButton, pressed && styles.entryButtonPressed]} onPress={() => setView('join')}>
                <View style={styles.entryIcon}>
                  <Ionicons name="enter-outline" size={28} color="#2563eb" />
                </View>
                <View style={styles.entryText}>
                  <Text style={styles.entryTitle}>Gabung Sesi</Text>
                  <Text style={styles.entrySub}>Scan QR atau masukkan kode sesi</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </Pressable>

            </Card>
          </ScrollView>
        </SafeAreaView>
      </DecorativeBackdrop>
    );
  }

  // ── Join ──────────────────────────────────────────────────────────────────

  if (view === 'join') {
    return (
      <DecorativeBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Card tone="accent" style={styles.heroCard}>
              <Text style={styles.appTitle}>PoinYuk</Text>
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Gabung Sesi</Text>
              <Text style={styles.sectionSub}>Masukkan kode 5 huruf dari pemilik sesi</Text>
              <View style={[styles.inputRow, { marginTop: 12 }]}>
                <TextInput
                  autoFocus
                  style={[styles.textInput, styles.codeInput]}
                  value={joinCode}
                  onChangeText={(v) => setJoinCode(v.toUpperCase())}
                  placeholder="Kode sesi..."
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  maxLength={5}
                  onSubmitEditing={() => { if (joinCode.length === 5) onJoinSession(joinCode); }}
                />
                <Pressable
                  style={({ pressed }) => [styles.addButton, { backgroundColor: '#2563eb' }, pressed && styles.addButtonPressed]}
                  onPress={() => { if (joinCode.length === 5) onJoinSession(joinCode); }}
                >
                  <Ionicons name="enter-outline" size={22} color="#ffffff" />
                </Pressable>
              </View>
            </Card>

            <Button label="Kembali" onPress={() => setView('landing')} variant="outline" />
          </ScrollView>
        </SafeAreaView>
      </DecorativeBackdrop>
    );
  }

  // ── Create / Setup form ───────────────────────────────────────────────────

  return (
    <DecorativeBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setView('landing')} style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.6 }]}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
            <Text style={styles.backRowText}>Kembali</Text>
          </Pressable>

          <Card tone="accent" style={styles.heroCard}>
            <Text style={styles.appTitle}>PoinYuk</Text>
            <SessionCodeBadge sessionCode={sessionCode} />
          </Card>

          <Card>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daftar Pemain</Text>
              <Text style={[styles.playerCount, { color: playerCountColor }]}>
                {setup.players.length} pemain
              </Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                autoFocus
                style={styles.textInput}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={addPlayer}
                placeholder="Nama pemain..."
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <Pressable
                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                onPress={addPlayer}
              >
                <Ionicons name="add" size={22} color="#ffffff" />
              </Pressable>
            </View>

            {setup.players.length > 0 && (
              <View style={styles.playerChipList}>
                {setup.players.map((name) => (
                  <View key={name} style={styles.playerChip}>
                    <Text style={styles.chipName}>{name}</Text>
                    <Pressable onPress={() => removePlayer(name)} style={styles.chipRemove} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Jenis Pertandingan</Text>
            <View style={styles.pillRow}>
              <Pill
                label="Single  (1 vs 1)"
                active={setup.mode === 'single'}
                onPress={() => onUpdateSetup({ mode: 'single' })}
              />
              <Pill
                label="Double  (2 vs 2)"
                active={setup.mode === 'double'}
                onPress={() => onUpdateSetup({ mode: 'double' })}
              />
            </View>
            {setup.players.length > 0 && setup.players.length < requiredPlayers && (
              <Text style={styles.warningText}>
                Butuh minimal {requiredPlayers} pemain untuk mode {setup.mode}. Baru ada {setup.players.length}.
              </Text>
            )}
          </Card>

          <Card tone="muted">
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Single Deuce + Sudden Death</Text>
                <Text style={styles.switchDesc}>Deuce kedua langsung menjadi sudden death.</Text>
              </View>
              <Switch
                value={setup.singleDeuceSuddenDeath}
                onValueChange={(value) => onUpdateSetup({ singleDeuceSuddenDeath: value })}
                trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                thumbColor={setup.singleDeuceSuddenDeath ? '#2563eb' : '#f8fafc'}
              />
            </View>
          </Card>

          <Button label="Lanjut ke Lineup →" onPress={onStartMatch} size="lg" disabled={!canStart} />
        </ScrollView>
      </SafeAreaView>

    </DecorativeBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 14,
  },
  landingContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 14,
    flexGrow: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  backRowText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  heroCard: { paddingVertical: 16, gap: 6 },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  landingCard: {
    padding: 0,
    overflow: 'hidden',
  },
  entryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  entryButtonPressed: { backgroundColor: '#f8fafc' },
  entryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: { flex: 1, gap: 2 },
  entryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  entrySub: {
    fontSize: 13,
    color: '#64748b',
  },
  entrySeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
  },
  playerCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    minHeight: 46,
    backgroundColor: '#ffffff',
    color: '#1f2937',
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  codeInput: {
    letterSpacing: 2,
    fontWeight: '900',
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { opacity: 0.8 },
  playerChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  chipRemove: {
    marginLeft: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  warningText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '700',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    gap: 12,
  },
  switchInfo: { flex: 1, gap: 3 },
  switchTitle: {
    fontWeight: '900',
    fontSize: 14,
    color: '#111827',
  },
  switchDesc: {
    fontSize: 12,
    color: palette.mutedForeground,
  },
});
