import { Pressable, Text, View } from 'react-native';
import { Badge } from '../../design-system/ui/Badge';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { courtCounts, playerStep } from '../../core/sessions/liveStrip';
import type { ActivityDetail, SessionParticipant } from '../../core/api/types';

type Props = {
  activities: ActivityDetail[];
  participants: SessionParticipant[];
  courtCount: number;
  myUserId?: string;
  isOrganizer: boolean;
  onPress: () => void;
};

// DP-024: while a Session is In Progress, a strip under the header on every
// tab — the player's own next step, or for organizers (and players with
// no match) the courts at a glance. Tapping it opens Matches.
export function LiveStrip({ activities, participants, courtCount, myUserId, isOrganizer, onPress }: Props) {
  const { t } = useTranslation();
  const input = { activities, participants, courtCount, myUserId };
  const step = isOrganizer ? undefined : playerStep(input);
  let line: string;
  if (step?.kind === 'playing') line = t('liveStripPlaying');
  else if (step?.kind === 'upNext') line = t('liveStripUpNext');
  else if (step?.kind === 'waiting') line = t('liveStripWaiting');
  else {
    const counts = courtCounts(input);
    line = t('liveStripCounts', counts.playing, counts.waiting, counts.courtsFree);
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-2.5 pl-4 pr-3 py-2.5 bg-asphalt dark:bg-asphalt-dark active:opacity-80"
    >
      <Badge action="live" text={t('activityStatusLive')} caps className="self-center" />
      <Text className="flex-1 text-sm font-sans-semibold text-on-asphalt" numberOfLines={1}>
        {line}
      </Text>
      <View>
        <Icon name="chevron-forward" size="md" color="onDark" />
      </View>
    </Pressable>
  );
}
