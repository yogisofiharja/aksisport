import Ionicons from '@expo/vector-icons/Ionicons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '../../components/ui/text';
import { TeamNames } from '../appTypes';
import { MatchState, Team } from '../scoring';
import { SessionCodeBadge } from '../components/SessionCodeBadge';

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  sessionCode: string | null;
  onShare: () => void;
  onBackToSetup: () => void;
  onClearSavedState: () => void;
  onShowHistory: () => void;
};

export function MobileFinalScreen({
  matchState,
  teamNames,
  sessionCode,
  onShare,
  onBackToSetup,
  onClearSavedState,
  onShowHistory,
}: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  const winner = matchState.winner;
  const winnerName = winner === 'A' ? teamNames.A : winner === 'B' ? teamNames.B : null;
  const completedSets = matchState.completedSets ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-900">
      <SafeAreaView className="flex-1">
        <StatusBar style={dark ? 'light' : 'dark'} />
        <ScrollView contentContainerClassName="px-5 pt-4 pb-8 gap-4">

          <View className="flex-row justify-between items-center">
            <View />
            <SessionCodeBadge sessionCode={sessionCode} />
          </View>

          {/* Winner banner */}
          <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 py-7 px-5 items-center gap-1.5">
            <Text className="text-5xl mb-1">🏆</Text>
            {winnerName ? (
              <>
                <Text className="text-[26px] font-black text-amber-600 text-center" numberOfLines={2}>{winnerName}</Text>
                <Text className="text-[17px] font-bold text-slate-500 dark:text-slate-400">Menang!</Text>
              </>
            ) : (
              <Text className="text-[26px] font-black text-slate-400 dark:text-slate-500">Pertandingan Selesai</Text>
            )}
          </View>

          {/* Scoreboard */}
          <View className="rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Scoreboard
              teamAName={teamNames.A}
              teamBName={teamNames.B}
              sets={matchState.sets}
              completedSets={completedSets}
              currentGames={matchState.games}
              winner={winner}
            />
          </View>

          {/* Bagikan — primary action */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onShare}
            className="bg-amber-600 rounded-2xl py-[18px] flex-row items-center justify-center gap-2.5"
          >
            <Ionicons name="share-social-outline" size={20} color="#ffffff" />
            <Text className="text-white text-[20px] font-black tracking-wide">Bagikan</Text>
          </TouchableOpacity>

          {/* Match Baru — full-width outlined */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onBackToSetup}
            className="bg-white dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-600 rounded-2xl py-4 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="add-circle-outline" size={20} color={dark ? '#f1f5f9' : '#111827'} />
            <Text className="text-[17px] font-extrabold text-slate-800 dark:text-slate-100">Match Baru</Text>
          </TouchableOpacity>

          {/* Riwayat — text link */}
          <TouchableOpacity onPress={onShowHistory} className="items-center py-1.5">
            <Text className="text-[15px] font-semibold text-slate-400 dark:text-slate-500 underline">Lihat Riwayat</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* Akhiri Sesi — pinned to bottom */}
        <View className="border-t border-slate-200 dark:border-slate-700 py-2.5 items-center">
          <TouchableOpacity className="py-2.5 px-6" onPress={() => setShowEndConfirm(true)}>
            <Text className="text-[15px] font-bold text-slate-400 dark:text-slate-500 underline">Akhiri Sesi</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {showEndConfirm && (
        <View className="absolute inset-0 bg-black/55 items-center justify-center">
          <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-7 py-7 items-center w-[300px] gap-2">
            <Ionicons name="warning-outline" size={32} color="#f59e0b" />
            <Text className="text-[21px] font-black text-slate-900 dark:text-slate-50 text-center mt-1">Akhiri Sesi?</Text>
            <Text className="text-[16px] text-slate-500 dark:text-slate-400 text-center leading-6 mb-1">Semua data sesi akan dihapus permanen.</Text>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowEndConfirm(false)}
                className="flex-1 py-3.5 rounded-xl items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-[17px] font-extrabold text-slate-500 dark:text-slate-400">Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setShowEndConfirm(false); onClearSavedState(); }}
                className="flex-1 py-3.5 rounded-xl items-center bg-amber-700"
              >
                <Text className="text-[17px] font-black text-amber-100">Akhiri</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Scoreboard({ teamAName, teamBName, sets, completedSets, currentGames, winner }: {
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
    <View className="bg-slate-900 rounded-2xl overflow-hidden">
      <ScoreRow name={teamAName} team="A" setTotal={sets.A} completedSets={completedSets} currentGames={currentGames} isWinner={winner === 'A'} hasOngoingGame={hasOngoingGame} showFallback={showFallback} showSetTotal={showSetTotal} />
      <View className="h-px bg-slate-700" />
      <ScoreRow name={teamBName} team="B" setTotal={sets.B} completedSets={completedSets} currentGames={currentGames} isWinner={winner === 'B'} hasOngoingGame={hasOngoingGame} showFallback={showFallback} showSetTotal={showSetTotal} />
    </View>
  );
}

function ScoreRow({ name, team, setTotal, completedSets, currentGames, isWinner, hasOngoingGame, showFallback, showSetTotal }: {
  name: string; team: Team; setTotal: number;
  completedSets: Array<{ A: number; B: number }>; currentGames: { A: number; B: number };
  isWinner: boolean; hasOngoingGame: boolean; showFallback: boolean; showSetTotal: boolean;
}) {
  const other: Team = team === 'A' ? 'B' : 'A';
  return (
    <View className="flex-row items-center min-h-[60px] px-4 gap-1">
      <Text className={`flex-1 text-[17px] font-bold mr-2.5 ${isWinner ? 'text-slate-50 font-black' : 'text-slate-500'}`} numberOfLines={1}>{name}</Text>
      {showFallback && <Text className="w-[42px] text-center text-[26px] font-black text-slate-600">0</Text>}
      {showSetTotal && (
        <>
          <Text className={`w-[34px] text-center text-[28px] font-black ${isWinner ? 'text-amber-500' : 'text-slate-600'}`}>{setTotal}</Text>
          <View className="w-px h-6 bg-slate-700 mx-1.5" />
        </>
      )}
      {completedSets.map((set, i) => {
        const won = set[team] > set[other];
        return <Text key={i} className={`w-[42px] text-center text-[26px] font-black ${won ? 'text-slate-50' : 'text-slate-600'}`}>{set[team]}</Text>;
      })}
      {hasOngoingGame && <Text className="w-[42px] text-center text-[26px] font-black text-yellow-300">{currentGames[team]}</Text>}
    </View>
  );
}
