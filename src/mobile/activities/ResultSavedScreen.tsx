import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../design-system/ui/Icon';
import { Typography } from '../../design-system/ui/Typography';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import type { TeamNames } from '../../appTypes';
import type { MatchState } from '../../sports/tennis/scoringEngine';

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  onShare: () => void;
  /** Opens the next queued match's start screen; absent when none is queued. */
  onSetUpNextMatch?: () => void;
  onBackToSession: () => void;
};

// DP-025 (Aksi redesign › Result saved): right after the umpire confirms.
// The result, then Share result, Set up next match and Back to session.
export function ResultSavedScreen({ matchState, teamNames, onShare, onSetUpNextMatch, onBackToSession }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const winner = matchState.winner;
  const winnerName = winner === 'A' ? teamNames.A : winner === 'B' ? teamNames.B : null;
  const loserName = winner === 'A' ? teamNames.B : winner === 'B' ? teamNames.A : null;
  // Sets won when there were sets, otherwise games — winner's first.
  const hasSets = matchState.sets.A > 0 || matchState.sets.B > 0;
  const tally = hasSets ? matchState.sets : matchState.games;
  const first = winner === 'B' ? tally.B : tally.A;
  const second = winner === 'B' ? tally.A : tally.B;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ground dark:bg-ground-dark">
      <View className="flex-row items-center min-h-[56px] px-1">
        <Pressable
          onPress={onBackToSession}
          accessibilityRole="button"
          accessibilityLabel={t('backToSession')}
          className="w-11 h-11 items-center justify-center active:opacity-60"
        >
          <Icon name="chevron-back" size="lg" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 12, alignItems: 'center' }}>
        <View className="flex-row items-center gap-1.5 h-7 px-3 rounded-full bg-success-tint dark:bg-success-tint-dark">
          <Icon name="checkmark" size="sm" color="default" />
          <Text className="text-xs font-sans-bold tracking-[0.9px] uppercase text-success dark:text-success-dark">{t('resultSaved')}</Text>
        </View>
        <Text
          accessibilityRole="header"
          className="mt-1 text-[36px] leading-[40px] font-display-hero text-ink dark:text-ink-dark text-center"
          numberOfLines={2}
        >
          {winnerName ? t('teamWins', winnerName) : t('matchDraw')}
        </Text>
        <Text className="font-display text-[56px] leading-[60px] text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
          {first}
          <Text className="text-ink-faint dark:text-ink-faint-dark">{'  –  '}</Text>
          {second}
        </Text>
        {loserName ? (
          <Typography variant="body" color="muted">
            {`${t('activityVersus')} ${loserName}`}
          </Typography>
        ) : null}
      </ScrollView>

      <View
        className="gap-2 px-4 pt-3 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button size="lg" className="w-full" leftIcon={<Icon name="share-outline" size="md" color="onBrand" />} onPress={onShare}>
          <ButtonText>{t('shareResultAction')}</ButtonText>
        </Button>
        {onSetUpNextMatch ? (
          <Button action="secondary" size="lg" className="w-full" onPress={onSetUpNextMatch}>
            <ButtonText>{t('setUpNextMatch')}</ButtonText>
          </Button>
        ) : null}
        <Button variant="ghost" size="md" className="w-full" onPress={onBackToSession}>
          <ButtonText>{t('backToSession')}</ButtonText>
        </Button>
      </View>
    </SafeAreaView>
  );
}
