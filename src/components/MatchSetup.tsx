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
import { MatchFormat } from '../sports/tennis/scoringEngine';
import { Button, Card, DecorativeBackdrop, palette, Pill } from './ui';
import { SessionCodeBadge } from './SessionCodeBadge';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();
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
                  <Text style={styles.entryTitle}>{t('startMatch')}</Text>
                  <Text style={styles.entrySub}>{t('startMatchSub')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </Pressable>

              <View style={styles.entrySeparator} />

              <Pressable style={({ pressed }) => [styles.entryButton, pressed && styles.entryButtonPressed]} onPress={() => setView('join')}>
                <View style={styles.entryIcon}>
                  <Ionicons name="enter-outline" size={28} color="#2563eb" />
                </View>
                <View style={styles.entryText}>
                  <Text style={styles.entryTitle}>{t('joinSession')}</Text>
                  <Text style={styles.entrySub}>{t('joinSessionSub')}</Text>
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
              <Text style={styles.sectionTitle}>{t('joinTitle')}</Text>
              <Text style={styles.sectionSub}>{t('joinDesc')}</Text>
              <View style={[styles.inputRow, { marginTop: 12 }]}>
                <TextInput
                  autoFocus
                  style={[styles.textInput, styles.codeInput]}
                  value={joinCode}
                  onChangeText={(v) => setJoinCode(v.toUpperCase())}
                  placeholder={t('sessionCodePlaceholder')}
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

            <Button label={t('back')} onPress={() => setView('landing')} variant="outline" />
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
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>

          <Card tone="accent" style={styles.heroCard}>
            <Text style={styles.appTitle}>PoinYuk</Text>
            <SessionCodeBadge sessionCode={sessionCode} />
          </Card>

          <Card>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('playerList')}</Text>
              <Text style={[styles.playerCount, { color: playerCountColor }]}>
                {t('playerCount', setup.players.length)}
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
                placeholder={t('playerNamePlaceholder')}
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
            <Text style={styles.sectionTitle}>{t('matchType')}</Text>
            <View style={styles.pillRow}>
              <Pill
                label={t('single')}
                active={setup.mode === 'single'}
                onPress={() => onUpdateSetup({ mode: 'single' })}
              />
              <Pill
                label={t('double')}
                active={setup.mode === 'double'}
                onPress={() => onUpdateSetup({ mode: 'double' })}
              />
            </View>
            {setup.players.length > 0 && setup.players.length < requiredPlayers && (
              <Text style={styles.warningText}>
                {t('needMorePlayers', requiredPlayers, setup.mode, setup.players.length)}
              </Text>
            )}
          </Card>

          {/* Format Pertandingan */}
          <Card>
            <Text style={styles.sectionTitle}>{t('matchFormat')}</Text>

            {/* Tab switcher: Custom | Regular */}
            {(() => {
              const isRegular = setup.matchFormat?.type === 'best-of-sets';
              return (
                <View style={[styles.pillRow, { marginBottom: 4 }]}>
                  {(['custom', 'regular'] as const).map(tab => {
                    const active = tab === 'regular' ? isRegular : !isRegular;
                    return (
                      <Pressable
                        key={tab}
                        style={({ pressed }) => [{
                          flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' as const,
                          borderWidth: 1.5,
                          borderColor: active ? '#d97706' : '#e2e8f0',
                          backgroundColor: active ? '#d97706' : '#f8fafc',
                          opacity: pressed ? 0.8 : 1,
                        }]}
                        onPress={() => {
                          if (tab === 'custom' && isRegular) {
                            onUpdateSetup({ matchFormat: { type: 'open' } });
                          } else if (tab === 'regular' && !isRegular) {
                            onUpdateSetup({ matchFormat: { type: 'best-of-sets', setsToWin: 2, superTiebreak: false } });
                          }
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '800', color: active ? '#ffffff' : '#64748b' }}>
                          {tab === 'custom' ? t('customTab') : t('regularTab')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })()}

            {/* Custom tab: Bebas / Total Game / Kejar Target */}
            {setup.matchFormat?.type !== 'best-of-sets' && (
              <>
                <View style={styles.pillRow}>
                  {(
                    [
                      { type: 'open' as const, label: t('formatOpen') },
                      { type: 'fixed-games' as const, label: t('formatFixedGames') },
                      { type: 'race-to' as const, label: t('formatRaceTo') },
                    ]
                  ).map(({ type, label }) => (
                    <Pill
                      key={type}
                      label={label}
                      active={(setup.matchFormat ?? { type: 'open' }).type === type}
                      onPress={() => {
                        let fmt: MatchFormat = { type: 'open' };
                        if (type === 'fixed-games') fmt = { type: 'fixed-games', totalGames: 4, goldenGameOnTie: false };
                        if (type === 'race-to') fmt = { type: 'race-to', raceTo: 4 };
                        onUpdateSetup({ matchFormat: fmt });
                      }}
                    />
                  ))}
                </View>

                {setup.matchFormat?.type === 'fixed-games' && (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchTitle}>{t('totalGames')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => { const cur = (setup.matchFormat as any).totalGames; if (cur > 2) onUpdateSetup({ matchFormat: { ...setup.matchFormat as any, totalGames: cur - 1 } }); }}>
                          <Text style={styles.stepBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepValue}>{(setup.matchFormat as any).totalGames}</Text>
                        <Pressable style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => { const cur = (setup.matchFormat as any).totalGames; if (cur < 20) onUpdateSetup({ matchFormat: { ...setup.matchFormat as any, totalGames: cur + 1 } }); }}>
                          <Text style={styles.stepBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.switchRow}>
                      <View style={styles.switchInfo}>
                        <Text style={styles.switchTitle}>{t('goldenGame')}</Text>
                        <Text style={styles.switchDesc}>{t('goldenGameDesc')}</Text>
                      </View>
                      <Switch
                        value={(setup.matchFormat as any).goldenGameOnTie}
                        onValueChange={v => onUpdateSetup({ matchFormat: { ...setup.matchFormat as any, goldenGameOnTie: v } })}
                        trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                        thumbColor={(setup.matchFormat as any).goldenGameOnTie ? '#2563eb' : '#f8fafc'}
                      />
                    </View>
                  </View>
                )}

                {setup.matchFormat?.type === 'race-to' && (
                  <View style={{ marginTop: 10 }}>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchTitle}>{t('targetGames')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => { const cur = (setup.matchFormat as any).raceTo; if (cur > 1) onUpdateSetup({ matchFormat: { type: 'race-to', raceTo: cur - 1 } }); }}>
                          <Text style={styles.stepBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepValue}>{(setup.matchFormat as any).raceTo}</Text>
                        <Pressable style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => { const cur = (setup.matchFormat as any).raceTo; if (cur < 20) onUpdateSetup({ matchFormat: { type: 'race-to', raceTo: cur + 1 } }); }}>
                          <Text style={styles.stepBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Regular tab: Best of Sets */}
            {setup.matchFormat?.type === 'best-of-sets' && (() => {
              const bos = setup.matchFormat as { type: 'best-of-sets'; setsToWin: number; superTiebreak: boolean };
              return (
                <View style={{ gap: 10 }}>
                  <Text style={styles.switchDesc}>{t('regularTabDesc')}</Text>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchTitle}>{t('setsToWin')}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {([1, 2, 3] as const).map(n => (
                        <Pressable key={n}
                          style={({ pressed }) => [{
                            width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const,
                            backgroundColor: bos.setsToWin === n ? '#d97706' : '#f1f5f9',
                            borderWidth: 1, borderColor: bos.setsToWin === n ? '#d97706' : '#e2e8f0',
                            opacity: pressed ? 0.7 : 1,
                          }]}
                          onPress={() => onUpdateSetup({ matchFormat: { ...bos, setsToWin: n, superTiebreak: n === 1 ? false : bos.superTiebreak } })}>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: bos.setsToWin === n ? '#ffffff' : '#1f2937' }}>{n}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  {bos.setsToWin > 1 && (
                    <View style={styles.switchRow}>
                      <View style={styles.switchInfo}>
                        <Text style={styles.switchTitle}>{t('superTiebreak')}</Text>
                        <Text style={styles.switchDesc}>{t('superTiebreakDesc')}</Text>
                      </View>
                      <Switch
                        value={bos.superTiebreak}
                        onValueChange={v => onUpdateSetup({ matchFormat: { ...bos, superTiebreak: v } })}
                        trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                        thumbColor={bos.superTiebreak ? '#2563eb' : '#f8fafc'}
                      />
                    </View>
                  )}
                </View>
              );
            })()}
          </Card>

          <Card tone="muted">
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>{t('singleDeuce')}</Text>
                <Text style={styles.switchDesc}>{t('singleDeuceDesc')}</Text>
              </View>
              <Switch
                value={setup.singleDeuceSuddenDeath}
                onValueChange={(value) => onUpdateSetup({ singleDeuceSuddenDeath: value })}
                trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                thumbColor={setup.singleDeuceSuddenDeath ? '#2563eb' : '#f8fafc'}
              />
            </View>
          </Card>

          <Button label={t('continueToLineup')} onPress={onStartMatch} size="lg" disabled={!canStart} />
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
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1f2937',
    lineHeight: 22,
  },
  stepValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    minWidth: 28,
    textAlign: 'center',
  },
});
