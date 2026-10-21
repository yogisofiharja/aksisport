import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Illustration } from '../../design-system/feedback/Illustration';
import { Typography } from '../../design-system/ui/Typography';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import type { TeamNames } from '../../appTypes';
import type { MatchState } from '../../sports/tennis/scoringEngine';
import { ScoreRow } from './MatchResultScreen';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  /** Leave without confirming; the match stays as it is (DP-025). */
  onBack: () => void;
  /** The umpire's view: Confirm result / Undo last point. Absent for spectators. */
  scorer?: {
    confirming: boolean;
    onConfirm: () => void;
    onUndo: () => void;
  };
};

// DP-025 (Aksi redesign › Match finished): the final point ends the match
// on the court, but the result is saved only when the umpire confirms.
// Until then the umpire can undo the last point, and everyone else sees
// the final score with "Waiting for the umpire to confirm".
export function MatchFinishedScreen({ matchState, teamNames, onBack, scorer }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const winnerName = matchState.winner === 'A' ? teamNames.A : matchState.winner === 'B' ? teamNames.B : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12, alignItems: 'center' }}>
        <Illustration name="match-won" width={160} />
        <Typography variant="overline" color="muted" className="mt-2">
          {t('matchFinished')}
        </Typography>
        <Text
          accessibilityRole="header"
          className="text-[36px] leading-[40px] font-display-hero text-ink dark:text-ink-dark text-center"
          numberOfLines={2}
        >
          {winnerName ? t('teamWins', winnerName) : t('matchDraw')}
        </Text>

        <View className="w-full mt-3 rounded-xl overflow-hidden bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
          <ScoreRow name={teamNames.A} team="A" matchState={matchState} />
          <View className="h-px bg-border dark:bg-border-dark" />
          <ScoreRow name={teamNames.B} team="B" matchState={matchState} />
        </View>

        {!scorer && (
          <View className="w-full flex-row items-center gap-2 rounded-xl px-4 py-3 bg-surface-sunken dark:bg-surface-sunken-dark">
            <View className="w-2 h-2 rounded-full bg-heat" />
            <Typography variant="body" color="muted" className="flex-1">
              {t('waitingForUmpire')}
            </Typography>
          </View>
        )}
      </ScrollView>

      {scorer && (
        <View
          className="gap-2 px-4 pt-3 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button size="lg" className="w-full" loading={scorer.confirming} isDisabled={scorer.confirming} onPress={scorer.onConfirm}>
            <ButtonText>{t('confirmResult')}</ButtonText>
          </Button>
          <Button variant="outline" size="lg" className="w-full" isDisabled={scorer.confirming} onPress={scorer.onUndo}>
            <ButtonText>{t('undoLastPoint')}</ButtonText>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}
