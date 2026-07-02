import Ionicons from '@expo/vector-icons/Ionicons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '../../components/ui/text';
import { MatchRecord } from '../appTypes';
import { SessionCodeBadge } from '../components/SessionCodeBadge';

type Props = {
  matchHistory: MatchRecord[];
  sessionCode: string | null;
  onBack: () => void;
  onShareMatch?: (record: MatchRecord) => void;
};

export function MobileHistoryScreen({ matchHistory, sessionCode, onBack, onShareMatch }: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-900">
      <SafeAreaView className="flex-1">
        <StatusBar style={dark ? 'light' : 'dark'} />
        <ScrollView contentContainerClassName="px-[18px] pt-3 pb-8 gap-3.5">

          <View className="flex-row items-center justify-between py-1.5">
            <TouchableOpacity onPress={onBack} className="p-2 -ml-2" activeOpacity={0.65}>
              <Ionicons name="arrow-back" size={24} color={dark ? '#e2e8f0' : '#111827'} />
            </TouchableOpacity>
            <SessionCodeBadge sessionCode={sessionCode} />
          </View>

          <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
            <Text className="text-[19px] font-black text-slate-900 dark:text-slate-50 mb-1">Riwayat Pertandingan</Text>
            {matchHistory.length === 0 && (
              <View className="items-center py-7 gap-2">
                <Ionicons name="stats-chart-outline" size={44} color={dark ? '#475569' : '#cbd5e1'} />
                <Text className="text-[17px] font-bold text-slate-500 dark:text-slate-400 mt-1">Belum ada riwayat</Text>
                <Text className="text-[15px] text-slate-400 dark:text-slate-600 text-center">
                  Selesaikan pertandingan pertamamu — hasilnya akan otomatis tercatat di sini.
                </Text>
              </View>
            )}
          </View>

          {matchHistory.map((record) => (
            <MatchCard
              key={record.id}
              record={record}
              dark={dark}
              onShare={onShareMatch ? () => onShareMatch(record) : undefined}
            />
          ))}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MatchCard({ record, dark, onShare }: {
  record: MatchRecord;
  dark: boolean;
  onShare?: () => void;
}) {
  const hasSets = record.sets.A > 0 || record.sets.B > 0;
  const headlineA = hasSets ? record.sets.A : record.games.A;
  const headlineB = hasSets ? record.sets.B : record.games.B;
  const breakdown = hasSets ? record.completedSets.map((s) => `${s.A}–${s.B}`).join('  ·  ') : null;
  const teamALabel = record.teams.A.join(' / ');
  const teamBLabel = record.teams.B.join(' / ');
  const winnerLabel = record.winner === 'A' ? teamALabel : record.winner === 'B' ? teamBLabel : null;
  const date = new Date(record.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-[17px] font-extrabold text-slate-700 dark:text-slate-300 text-left" numberOfLines={2}>{teamALabel}</Text>
        <Text className="text-[14px] font-bold text-slate-400 dark:text-slate-500">vs</Text>
        <Text className="flex-1 text-[17px] font-extrabold text-slate-700 dark:text-slate-300 text-right" numberOfLines={2}>{teamBLabel}</Text>
      </View>

      <View className="flex-row items-center justify-center gap-3.5 mt-0.5">
        <Text className={`text-[34px] font-black min-w-[34px] text-center ${record.winner === 'A' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-600'}`}>{headlineA}</Text>
        <Text className="text-[24px] font-black text-slate-300 dark:text-slate-700">—</Text>
        <Text className={`text-[34px] font-black min-w-[34px] text-center ${record.winner === 'B' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-600'}`}>{headlineB}</Text>
      </View>

      {hasSets && <Text className="text-center text-[12px] font-black text-slate-400 tracking-widest -mt-1.5">SET</Text>}
      {breakdown && <Text className="text-center text-[15px] font-bold text-slate-500 tracking-wide">{breakdown}</Text>}

      <View className="flex-row items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-2.5 mt-0.5">
        <View className="gap-1 flex-1">
          {winnerLabel ? (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="trophy" size={13} color="#d97706" />
              <Text className="text-[15px] font-bold text-amber-600">{winnerLabel} Menang</Text>
            </View>
          ) : (
            <Text className="text-[15px] font-bold text-slate-400">Tidak ada pemenang</Text>
          )}
          <Text className="text-[14px] font-semibold text-slate-400 dark:text-slate-500">{date}</Text>
        </View>
        {onShare && (
          <TouchableOpacity onPress={onShare} className="p-2 rounded-xl ml-1" activeOpacity={0.7}>
            <Ionicons name="share-social-outline" size={18} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
