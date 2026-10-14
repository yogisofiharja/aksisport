import { View } from 'react-native';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';

// How many messages in a conversation the viewer hasn't read (DP-021).
// Renders nothing at zero.
export function UnreadCount({ count }: { count: number }) {
  const { t } = useTranslation();
  if (!count) return null;
  return (
    <View
      className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-blue-600 items-center justify-center"
      accessibilityLabel={t('inboxUnread', count)}
    >
      <Typography variant="body" className="text-xs font-extrabold text-white">
        {count > 99 ? '99+' : String(count)}
      </Typography>
    </View>
  );
}
