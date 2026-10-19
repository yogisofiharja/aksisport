import { Pressable, View } from 'react-native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import type { TeamNames } from '../../appTypes';
import type { MatchState, Team } from '../../sports/tennis/scoringEngine';

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  onShare: () => void;
  // Right after finishing: back to the Session's matches, where the next
  // one is picked. Absent when an earlier match is opened from the list.
  onNextMatch?: () => void;
  // Opened from the list later: a back arrow instead.
  onBack?: () => void;
};

// A finished Session match: who won, the score, and Share (any time) —
// plus "Next match" right after it ends.
export function MatchResultScreen({ matchState, teamNames, onShare, onNextMatch, onBack }: Props) {
  const { t } = useTranslation();

  const winner = matchState.winner;
  const winnerName = winner === 'A' ? teamNames.A : winner === 'B' ? teamNames.B : null;

  return (
    <ScrollPage gap="lg">
      {onBack && (
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack} accessibilityLabel={t('back')}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
      )}
      <Card padding="xl">
        <VStack space="sm" className="items-center">
          <View className="w-16 h-16 rounded-full items-center justify-center bg-heat-tint dark:bg-heat-tint-dark">
            <Icon name="trophy" size="xl" color="secondary" />
          </View>
          {winnerName ? (
            <>
              <Typography variant="display" style={{ textAlign: 'center' }} numberOfLines={2}>
                {winnerName}
              </Typography>
              <Typography variant="body" color="muted" className="font-bold">
                {t('winnerLabel')}
              </Typography>
            </>
          ) : (
            <Typography variant="title" color="muted">
              {t('matchOver')}
            </Typography>
          )}
        </VStack>
      </Card>

      <Card padding="none">
        <ScoreRow name={teamNames.A} team="A" matchState={matchState} />
        <View className="h-px bg-surface-sunken dark:bg-surface-sunken-dark" />
        <ScoreRow name={teamNames.B} team="B" matchState={matchState} />
      </Card>

      <VStack space="md">
        {onNextMatch && (
          <Button size="xl" className="w-full" onPress={onNextMatch}>
            <HStack space="sm" className="items-center">
              <ButtonText>
                {t('nextMatch')}
              </ButtonText>
              <Icon name="arrow-forward" size="sm" color="onBrand" />
            </HStack>
          </Button>
        )}
        {/* Share is the main action when there's no "Next match" */}
        <Button variant={onNextMatch ? 'outline' : 'solid'} size="xl" className="w-full" onPress={onShare}>
          <HStack space="sm" className="items-center">
            <Icon name="share-social-outline" size="sm" color={onNextMatch ? 'default' : 'onBrand'} />
            <ButtonText variant={onNextMatch ? 'outline' : 'solid'}>
              {t('shareResult')}
            </ButtonText>
          </HStack>
        </Button>
      </VStack>
    </ScrollPage>
  );
}

// One side's line: name, then sets won and each set's games (or, for a
// match with no completed set, the games of the set in progress).
function ScoreRow({ name, team, matchState }: { name: string; team: Team; matchState: MatchState }) {
  const other: Team = team === 'A' ? 'B' : 'A';
  const sets = matchState.completedSets ?? [];
  const isWinner = matchState.winner === team;
  const ongoing = matchState.games.A > 0 || matchState.games.B > 0;
  const scores: Array<{ value: number; won: boolean }> = sets.map((s) => ({ value: s[team], won: s[team] > s[other] }));
  if (ongoing) scores.push({ value: matchState.games[team], won: matchState.games[team] > matchState.games[other] });
  if (scores.length === 0) scores.push({ value: 0, won: false });

  return (
    <HStack className="items-center px-5 py-4" space="md">
      <Typography
        variant="body"
        className={`text-lg ${isWinner ? 'font-black' : 'font-semibold'}`}
        color={isWinner ? 'default' : 'muted'}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {name}
      </Typography>
      {sets.length > 0 && (
        <Typography variant="body" className={`text-2xl font-black w-8 text-center ${isWinner ? 'text-heat-strong dark:text-heat-strong-dark' : 'text-ink-faint dark:text-ink-faint-dark'}`}>
          {matchState.sets[team]}
        </Typography>
      )}
      {scores.map((s, i) => (
        <Typography
          key={i}
          variant="body"
          className={`text-2xl font-black w-8 text-center ${s.won ? 'text-ink dark:text-ink-dark' : 'text-ink-faint dark:text-ink-faint-dark'}`}
        >
          {s.value}
        </Typography>
      ))}
    </HStack>
  );
}
