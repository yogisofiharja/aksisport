import { Text, View } from 'react-native';
import { initialsFromName } from '../../core/initials';
import { Button, ButtonText } from '../ui/Button';

/**
 * An in-app invitation on the friend's Home (Aksi redesign › Invite friends
 * · Home): the inviter's initials on an ink disc and "<Name> invited you",
 * the target's name in Saira, up to two lines about it (when and where;
 * the Community and price), then Not now and Join. A 2px ink frame sets it
 * apart from the Session rows below.
 *
 * Renders only: the screen passes the texts and the two actions.
 */

type InviteCardProps = {
  fromName: string;
  /** "Yogi invited you", with the name bold — passed as the two parts. */
  invitedYou: [before: string, after: string];
  title: string;
  lines: string[];
  notNowLabel: string;
  joinLabel: string;
  onNotNow: () => void;
  onJoin: () => void;
};

export function InviteCard({ fromName, invitedYou, title, lines, notNowLabel, joinLabel, onNotNow, onJoin }: InviteCardProps) {
  return (
    <View className="p-4 gap-3 rounded-xl bg-surface dark:bg-surface-dark border-2 border-ink dark:border-ink-dark">
      <View className="flex-row items-center gap-2.5">
        <View className="w-8 h-8 rounded-full items-center justify-center bg-ink dark:bg-ink-dark">
          <Text className="text-sm font-sans-bold text-surface dark:text-surface-dark">{initialsFromName(fromName)}</Text>
        </View>
        <Text className="flex-1 text-sm leading-5 font-sans text-ink dark:text-ink-dark">
          {invitedYou[0]}
          <Text className="font-sans-bold">{fromName}</Text>
          {invitedYou[1]}
        </Text>
      </View>
      <View>
        <Text className="text-xl leading-6 font-display text-ink dark:text-ink-dark">{title}</Text>
        {lines.map((line) => (
          <Text key={line} className="mt-0.5 text-[13px] leading-[18px] font-sans text-ink-muted dark:text-ink-muted-dark">
            {line}
          </Text>
        ))}
      </View>
      <View className="flex-row justify-end gap-2">
        <Button size="sm" variant="outline" onPress={onNotNow}>
          <ButtonText>{notNowLabel}</ButtonText>
        </Button>
        <Button size="sm" onPress={onJoin}>
          <ButtonText>{joinLabel}</ButtonText>
        </Button>
      </View>
    </View>
  );
}
