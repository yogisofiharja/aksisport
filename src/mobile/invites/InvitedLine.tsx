import { Text, View } from 'react-native';
import { initialsFromName } from '../../core/initials';

// "<Name> invited you to join session" above a Session's tabs, for an
// invited non-member (DP-028; Aksi redesign › Session as an invited
// visitor). `text` is the translated sentence with \u0000 where the name
// goes, so the name can be bold in either language.
export function InvitedLine({ name, text }: { name: string; text: string }) {
  const [before, after] = text.split('\u0000');
  return (
    <View className="flex-row items-center gap-2.5 px-4 py-2.5 bg-surface-sunken dark:bg-surface-sunken-dark border-b border-border dark:border-border-dark">
      <View className="w-7 h-7 rounded-full items-center justify-center bg-ink dark:bg-ink-dark">
        <Text className="text-[11px] font-sans-bold text-surface dark:text-surface-dark">{initialsFromName(name)}</Text>
      </View>
      <Text className="flex-1 text-sm leading-5 font-sans text-ink dark:text-ink-dark">
        {before}
        <Text className="font-sans-bold">{name}</Text>
        {after}
      </Text>
    </View>
  );
}
