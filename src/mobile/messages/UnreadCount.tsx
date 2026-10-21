import { CountBadge } from '../../design-system/ui/Chip';
import { useTranslation } from '../../i18n';

// How many messages in a conversation the viewer hasn't read (DP-021), as
// the design system's heat CountBadge. Renders nothing at zero.
export function UnreadCount({ count }: { count: number }) {
  const { t } = useTranslation();
  return <CountBadge count={count} accessibilityLabel={t('inboxUnread', count)} />;
}
