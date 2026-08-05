import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { Typography } from '../../design-system/ui/Typography';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';

// Milestone 1 (Personal Context Shell): minimal placeholder tab. Real
// discovery behavior (search, nearby, public listings) stays Planning-only
// in AKSI_PRODUCT_DECISIONS.md until explicitly promoted.
export function ExploreScreen() {
  const { t } = useTranslation();

  return (
    <ScrollPage gap="lg">
      <Typography variant="display">{t('exploreTitle')}</Typography>
      <EmptyState message={t('exploreEmptyState')} />
    </ScrollPage>
  );
}
