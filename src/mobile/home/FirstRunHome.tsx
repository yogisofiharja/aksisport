import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Card } from '../../design-system/ui/Card';
import { ListRow } from '../../design-system/ui/List';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';

type Props = {
  onOpenExplore: () => void;
  onCreateClub: () => void;
};

// Home with no Community yet (Aksi redesign › First run): find one near
// you, or start your own. A shared community link lands right on that
// community, so the page says so.
export function FirstRunHome({ onOpenExplore, onCreateClub }: Props) {
  const { t } = useTranslation();
  return (
    <VStack space="md">
      <Card padding="none">
        <EmptyState illustration="no-members" title={t('firstRunTitle')} message={t('firstRunMessage')} />
      </Card>
      <ListRow
        framed="dark"
        icon="compass-outline"
        title={t('firstRunFindTitle')}
        subtitle={t('firstRunFindDesc')}
        chevron
        onPress={onOpenExplore}
      />
      <ListRow framed="light" icon="add" title={t('firstRunStartTitle')} subtitle={t('firstRunStartDesc')} chevron onPress={onCreateClub} />
      <Typography variant="body" color="muted" className="text-center text-[13px] leading-[18px] mt-1">
        {t('firstRunLinkHint')}
      </Typography>
    </VStack>
  );
}
