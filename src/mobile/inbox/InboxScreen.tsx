import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { Typography } from '../../design-system/ui/Typography';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';

// Milestone 1 (Personal Context Shell): minimal placeholder tab — no
// Communication data model exists yet (needs its own Product Decision
// before real content can land here).
export function InboxScreen() {
  const { t } = useTranslation();

  return (
    <ScrollPage gap="lg">
      <Typography variant="display">{t('inboxTitle')}</Typography>
      <EmptyState message={t('inboxEmptyState')} />
    </ScrollPage>
  );
}
