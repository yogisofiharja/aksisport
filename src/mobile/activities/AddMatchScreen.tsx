import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, Divider, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { createActivity } from '../../core/activities/api';
import { listParticipants } from '../../core/sessions/api';
import type { SessionParticipant } from '../../core/api/types';
import type { MatchConfig, MatchFormat, MatchMode, Player, Team } from '../../sports/tennis/scoringEngine';

type Props = {
  sessionId: string;
  onBack: () => void;
  onCreated: () => void;
};

function participantLabel(p: SessionParticipant): string {
  return p.displayName || p.username || p.guestName || 'Player';
}

function buildServiceOrder(players: Player[], firstServerId: string): string[] {
  const teamA = players.filter((p) => p.team === 'A');
  const teamB = players.filter((p) => p.team === 'B');
  const base: string[] = [];
  const maxCount = Math.max(teamA.length, teamB.length);
  for (let i = 0; i < maxCount; i++) {
    if (teamA[i]) base.push(teamA[i].id);
    if (teamB[i]) base.push(teamB[i].id);
  }
  const startIdx = base.indexOf(firstServerId);
  if (startIdx < 0) return base;
  return [...base.slice(startIdx), ...base.slice(0, startIdx)];
}

export function AddMatchScreen({ sessionId, onBack, onCreated }: Props) {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MatchMode>('single');
  const [assignedOrder, setAssignedOrder] = useState<string[]>([]);
  const [firstServerId, setFirstServerId] = useState<string | null>(null);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>({ type: 'open' });
  const [singleDeuceSuddenDeath, setSingleDeuceSuddenDeath] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listParticipants(sessionId)
      .then(setParticipants)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const checkedIn = participants.filter((p) => p.status === 'checked_in');
  const perTeam = mode === 'double' ? 2 : 1;
  const maxAssigned = perTeam * 2;
  const isFull = assignedOrder.length === maxAssigned;
  const canCreate = isFull && Boolean(firstServerId) && !submitting;

  function getSide(id: string): 'A' | 'B' | null {
    const idx = assignedOrder.indexOf(id);
    if (idx === -1) return null;
    return idx < perTeam ? 'A' : 'B';
  }

  function handleModeChange(next: MatchMode) {
    if (next === mode) return;
    setMode(next);
    setAssignedOrder([]);
    setFirstServerId(null);
  }

  function handleTap(id: string) {
    if (assignedOrder.includes(id)) {
      setAssignedOrder((prev) => prev.filter((p) => p !== id));
      if (firstServerId === id) setFirstServerId(null);
      return;
    }
    if (isFull) return;
    setAssignedOrder((prev) => [...prev, id]);
  }

  async function handleSubmit() {
    if (!canCreate) return;
    setSubmitting(true);
    setError(null);
    try {
      const assigned = assignedOrder.map((id) => checkedIn.find((p) => p.id === id)!);
      const players: Player[] = assigned.map((p, i) => ({
        id: p.id,
        name: participantLabel(p),
        team: (i < perTeam ? 'A' : 'B') as Team,
      }));
      const config: MatchConfig = {
        mode,
        deuceMode: singleDeuceSuddenDeath ? 'singleDeuceSuddenDeath' : 'standard',
        players,
        serviceOrderPlayerIds: buildServiceOrder(players, firstServerId!),
        matchFormat,
      };
      const participantInputs = assigned.map((p, i) => ({
        userId: p.userId,
        guestName: p.userId ? undefined : p.guestName,
        team: (i < perTeam ? 'A' : 'B') as Team,
      }));
      await createActivity(sessionId, config, participantInputs);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
        <HStack className="justify-between items-center">
          <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
            <Ionicons name="arrow-back" size={24} />
          </Pressable>
          <Heading size="xl">{t('activityAddTitle')}</Heading>
          <Box className="w-10" />
        </HStack>

        {/* Mode */}
        <Box className="bg-white dark:bg-slate-800 rounded-2xl">
          <Text className="px-5 pt-4 pb-2 text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
            {t('matchType')}
          </Text>
          <Divider />
          <HStack className="px-5 py-4 gap-3">
            {(['single', 'double'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => handleModeChange(m)}
                className={`flex-1 py-4 rounded-xl items-center border-2 ${
                  mode === m ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-600' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                }`}
              >
                <Text style={{ fontWeight: '800', color: mode === m ? '#d97706' : undefined }}>
                  {m === 'single' ? t('single') : t('double')}
                </Text>
              </TouchableOpacity>
            ))}
          </HStack>
        </Box>

        {/* Participants */}
        <Box className="bg-white dark:bg-slate-800 rounded-2xl">
          <HStack className="px-5 pt-4 pb-2 justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
              {t('activityPickParticipants')}
            </Text>
            <Text className="text-sm font-bold text-slate-400">{assignedOrder.length} / {maxAssigned}</Text>
          </HStack>
          <Divider />
          {checkedIn.length === 0 ? (
            <Text className="px-5 py-4 text-slate-500 dark:text-slate-400">{t('activityNoCheckedIn')}</Text>
          ) : (
            <Box className="px-5 py-4 flex-row flex-wrap gap-2">
              {checkedIn.map((p) => {
                const side = getSide(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handleTap(p.id)}
                    className={`px-4 py-2.5 rounded-full border-[1.5px] ${
                      side === 'A'
                        ? 'bg-blue-600 border-blue-600'
                        : side === 'B'
                          ? 'bg-red-600 border-red-600'
                          : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <Text style={{ fontWeight: '700', color: side ? '#fff' : undefined }}>{participantLabel(p)}</Text>
                  </Pressable>
                );
              })}
            </Box>
          )}
          {!isFull && assignedOrder.length > 0 && (
            <Text className="px-5 pb-4 text-sm text-amber-600">
              {t('activityNeedParticipants', maxAssigned, mode, assignedOrder.length)}
            </Text>
          )}
        </Box>

        {/* First server */}
        {isFull && (
          <Box className="bg-white dark:bg-slate-800 rounded-2xl">
            <Text className="px-5 pt-4 pb-2 text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
              {t('firstServer')}
            </Text>
            <Divider />
            <Box className="px-5 py-4 flex-row flex-wrap gap-2">
              {assignedOrder.map((id) => {
                const p = checkedIn.find((cp) => cp.id === id)!;
                const active = firstServerId === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setFirstServerId(id)}
                    className={`px-4 py-2.5 rounded-full border-[1.5px] ${
                      active ? 'bg-teal-600 border-teal-600' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <Text style={{ fontWeight: '700', color: active ? '#fff' : undefined }}>{participantLabel(p)}</Text>
                  </Pressable>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Match format */}
        <Box className="bg-white dark:bg-slate-800 rounded-2xl">
          <Text className="px-5 pt-4 pb-2 text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
            {t('matchFormat')}
          </Text>
          <Divider />
          <VStack className="px-5 py-4 gap-2">
            {(
              [
                { type: 'open', label: t('formatOpen') },
                { type: 'fixed-games', label: t('formatFixedGames') },
                { type: 'race-to', label: t('formatRaceTo') },
                { type: 'best-of-sets', label: t('regularTab') },
              ] as const
            ).map(({ type, label }) => {
              const active = matchFormat.type === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    if (type === 'open') setMatchFormat({ type: 'open' });
                    if (type === 'fixed-games') setMatchFormat({ type: 'fixed-games', totalGames: 4, goldenGameOnTie: false });
                    if (type === 'race-to') setMatchFormat({ type: 'race-to', raceTo: 4 });
                    if (type === 'best-of-sets') setMatchFormat({ type: 'best-of-sets', setsToWin: 2, superTiebreak: false });
                  }}
                  className={`py-3 px-4 rounded-xl border-2 ${
                    active ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-600' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <Text style={{ fontWeight: '800', color: active ? '#d97706' : undefined }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </VStack>
        </Box>

        {/* Deuce */}
        <Box className="bg-white dark:bg-slate-800 rounded-2xl">
          <HStack className="px-5 py-4 justify-between items-center gap-4">
            <VStack className="flex-1 gap-1">
              <Text style={{ fontWeight: '800' }}>{t('singleDeuce')}</Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400">{t('singleDeuceDesc')}</Text>
            </VStack>
            <Switch value={singleDeuceSuddenDeath} onValueChange={setSingleDeuceSuddenDeath} />
          </HStack>
        </Box>

        {error && <Text className="text-sm text-red-500">{error}</Text>}

        <Button size="xl" isDisabled={!canCreate} className="w-full rounded-2xl" onPress={handleSubmit}>
          <ButtonText className="text-white text-lg">{t('activityCreate')}</ButtonText>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
