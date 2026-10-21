import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import { Sheet } from '../../design-system/feedback/Sheet';
import { color } from '../../design-system/foundation/colors';
import { Icon } from '../../design-system/ui/Icon';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Owners/admins to ask, when the umpire isn't one of them. */
  askOrganizers?: string[];
  /** Free Play only (DP-025): finish on the current score. */
  onFinish?: () => void;
  /** End match early (DP-025): closes the sheet, then asks to confirm. */
  onEndEarly: () => void;
};

// "a", "a or b", "a, b or c".
function joinNames(names: string[], or: string): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${or} ${names[names.length - 1]}`;
}

// The umpire's Match options while scoring (Aksi redesign › board 8b):
// Finish match (Free Play only) and End match early (DP-025). An umpire who isn't an organizer can't hand
// the role on (DP-023), so they are told whom to ask instead.
export function MatchOptionsSheet({ visible, onClose, askOrganizers, onFinish, onEndEarly }: Props) {
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
      {askOrganizers ? <View className="h-1.5 -mx-5 bg-surface-sunken dark:bg-surface-sunken-dark" /> : null}
      {onFinish ? (
        <Pressable
          onPress={() => {
            onClose();
            onFinish();
          }}
          accessibilityRole="button"
          className="flex-row items-center gap-3 min-h-[60px] active:opacity-60"
        >
          <View className="w-10 h-10 rounded-lg items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark">
            <Icon name="flag-outline" size="md" />
          </View>
          <View className="flex-1">
            <Typography variant="body" className="font-semibold">
              {t('finishMatch')}
            </Typography>
            <Typography variant="body" color="muted" className="text-[13px] leading-[18px]">
              {t('finishMatchHint')}
            </Typography>
          </View>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => {
          onClose();
          // Let the sheet's Modal close before the Dialog opens.
          setTimeout(onEndEarly, 250);
        }}
        accessibilityRole="button"
        className={`flex-row items-center gap-3 min-h-[60px] active:opacity-60 ${onFinish ? 'border-t border-border dark:border-border-dark' : ''}`}
      >
        <View className="w-10 h-10 rounded-lg items-center justify-center bg-danger-tint dark:bg-danger-tint-dark">
          <Icon name="stop-outline" size="md" color="destructive" />
        </View>
        <View className="flex-1">
          <Typography variant="body" color="destructive" className="font-semibold">
            {t('endMatchEarly')}
          </Typography>
          <Typography variant="body" color="muted" className="text-[13px] leading-[18px]">
            {t('endMatchEarlyHint')}
          </Typography>
        </View>
      </Pressable>
    </Sheet>
  );
}
