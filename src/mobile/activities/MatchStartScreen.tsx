import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import { spinSteps } from '../../core/activities/spin';
import type { TeamASide } from '../../appTypes';
import type { Player, Team } from '../../sports/tennis/scoringEngine';

type Props = {
  players: Player[];
  starting: boolean;
  onBack: () => void;
  onStart: (choice: { teamASide: TeamASide; firstServerId: string }) => void;
};

// DP-022: before a match starts, whoever is about to score sets which team
// plays on the left and which on the right (switchable), and who serves
// first — picked, or at random. Sides are then fixed for the match.
export function MatchStartScreen({ players, starting, onBack, onStart }: Props) {
  const { t } = useTranslation();
  const [teamASide, setTeamASide] = useState<TeamASide>('left');
  const [firstServerId, setFirstServerId] = useState<string | null>(null);

  const leftTeam: Team = teamASide === 'left' ? 'A' : 'B';
  const rightTeam: Team = leftTeam === 'A' ? 'B' : 'A';

  // Random: the highlight spins across the players in on-screen order
  // (left side, then right), slowing down until it stops on the pick.
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function pickRandom() {
    if (spinning || players.length === 0) return;
    const order = [...players.filter((p) => p.team === leftTeam), ...players.filter((p) => p.team === rightTeam)];
    const current = order.findIndex((p) => p.id === firstServerId);
    const target = Math.floor(Math.random() * order.length);
    const steps = spinSteps(order.length, current < 0 ? order.length - 1 : current, target);
    setSpinning(true);
    let at = 0;
    steps.forEach((step, i) => {
      at += step.delayMs;
      timers.current.push(
        setTimeout(() => {
          setFirstServerId(order[step.index].id);
          const last = i === steps.length - 1;
          (last ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
          if (last) {
            setSpinning(false);
            timers.current = [];
          }
        }, at)
      );
    });
  }

  function half(team: Team, position: 'left' | 'right') {
    const teamPlayers = players.filter((p) => p.team === team);
    // Left in heat with ink text, right in asphalt with light text — the
    // same team colours as the scoring screen.
    const left = position === 'left';
    const fg = left ? 'text-on-heat' : 'text-on-asphalt';
    return (
      <View
        className={`flex-1 rounded-xl px-3 py-4 gap-3 ${left ? 'bg-heat' : 'bg-asphalt dark:bg-asphalt-dark'}`}
        accessibilityLabel={position === 'left' ? t('matchStartLeftHalf') : t('matchStartRightHalf')}
      >
        <Typography variant="overline" className={`${fg} opacity-70 text-center`}>
          {position === 'left' ? t('matchStartLeftHalf') : t('matchStartRightHalf')}
        </Typography>
        <VStack space="sm">
          {teamPlayers.map((p) => {
            const serving = firstServerId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setFirstServerId(p.id)}
                disabled={spinning}
                // The server's chip is solid: ink on the orange side, light on
                // the dark side, with the ball as a small dot before the name.
                className={`flex-row items-center justify-center gap-2 px-3 py-2.5 rounded-full border-[1.5px] active:opacity-70 ${
                  serving
                    ? left
                      ? 'bg-ink border-ink'
                      : 'bg-on-asphalt border-on-asphalt'
                    : left
                      ? 'border-on-heat/40'
                      : 'border-on-asphalt/30'
                }`}
                accessibilityLabel={t('matchStartServes', p.name)}
              >
                {serving && <View className="w-2 h-2 rounded-full bg-ball" />}
                <Typography
                  variant="body"
                  numberOfLines={1}
                  className={`font-bold ${serving ? (left ? 'text-on-asphalt' : 'text-ink') : fg}`}
                >
                  {p.name}
                </Typography>
              </Pressable>
            );
          })}
        </VStack>
      </View>
    );
  }

  return (
    <ScrollPage gap="lg">
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>
      <VStack space="xs">
        <Typography variant="heading">{t('matchStartTitle')}</Typography>
        <Typography variant="body" color="muted">
          {t('matchStartExplainer')}
        </Typography>
      </VStack>

      <Card>
        <VStack space="md">
          <HStack space="sm">
            {half(leftTeam, 'left')}
            {half(rightTeam, 'right')}
          </HStack>
          <Button
            variant="outline"
            disabled={spinning}
            onPress={() => setTeamASide(teamASide === 'left' ? 'right' : 'left')}
          >
            <HStack space="sm" className="items-center">
              <Icon name="swap-horizontal" size="sm" color="secondary" />
              <ButtonText variant="outline">
                {t('matchStartSwitchSides')}
              </ButtonText>
            </HStack>
          </Button>
        </VStack>
      </Card>

      <HStack className="items-center justify-between" space="md">
        <Typography variant="body" color={firstServerId && !spinning ? 'default' : 'muted'} style={{ flex: 1 }}>
          {spinning
            ? t('matchStartChoosing')
            : firstServerId
              ? t('matchStartServes', players.find((p) => p.id === firstServerId)?.name ?? '')
              : t('matchStartPickServer')}
        </Typography>
        <Button variant="outline" size="sm" onPress={pickRandom} disabled={spinning}>
          <HStack space="xs" className="items-center">
            <Icon name="shuffle" size="sm" color="secondary" />
            <ButtonText variant="outline">
              {t('matchStartRandom')}
            </ButtonText>
          </HStack>
        </Button>
      </HStack>

      <Button
        size="xl"
        className="w-full"
        disabled={!firstServerId || spinning}
        loading={starting}
        onPress={() => firstServerId && onStart({ teamASide, firstServerId })}
      >
        <ButtonText>{t('matchStartButton')}</ButtonText>
      </Button>
    </ScrollPage>
  );
}
