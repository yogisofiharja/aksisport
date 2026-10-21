import type { ReactNode } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import { Sheet } from '../../design-system/feedback/Sheet';
import { color } from '../../design-system/foundation/colors';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Owners/admins to ask, when the umpire isn't one of them. */
  askOrganizers?: string[];
  children?: ReactNode;
};

// "a", "a or b", "a, b or c".
function joinNames(names: string[], or: string): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${or} ${names[names.length - 1]}`;
}

// The umpire's Match options while scoring (Aksi redesign › board 8b). An
// umpire who isn't an organizer can't hand the role on (DP-023), so they
// are told whom to ask instead.
export function MatchOptionsSheet({ visible, onClose, askOrganizers, children }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('matchOptions')}>
      {askOrganizers ? (
        <View className="flex-row items-start gap-3 px-3.5 py-3 rounded-xl bg-info-tint dark:bg-info-tint-dark">
          <View className="mt-0.5">
            <Ionicons name="information-circle-outline" size={20} color={color.info[colorScheme === 'dark' ? 'dark' : 'light']} />
          </View>
          <View className="flex-1">
            <Typography variant="body" className="font-bold text-sm leading-5">
              {t('umpireBreakTitle')}
            </Typography>
            <Typography variant="body" className="text-sm leading-5">
              {t('umpireBreakBody', joinNames(askOrganizers, t('orWord')))}
            </Typography>
          </View>
        </View>
      ) : null}
      {children}
    </Sheet>
  );
}
