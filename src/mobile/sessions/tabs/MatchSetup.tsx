import { Box, HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Button, ButtonText } from '../../../../components/ui/button';
import { useTranslation } from '../../../i18n';
import { matchFormatSummary } from '../../../core/sessions/matchFormatSummary';
import type { MatchFormat } from '../../../sports/tennis/scoringEngine';
import type { Session } from '../../../core/api/types';

type Props = {
  session: Session;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
};

// Match Setup — defined once per Session, reused by every Generate
// Matches / Custom Match action instead of being reconfigured each time
// (AddMatchScreen just reads session.defaultMatchFormat/defaultSingleDeuce).
// Edited through the same Edit Session form as everything else, in the same
// editable window.
export function MatchSetup({ session, canEdit, busy, onEdit }: Props) {
  const { t } = useTranslation();
  const matchFormat: MatchFormat = (session.defaultMatchFormat as MatchFormat) ?? { type: 'open' };
  const singleDeuce = session.defaultSingleDeuce ?? true;
  return (
    <VStack className="gap-5">
      <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
        <VStack className="gap-2">
          <HStack className="justify-between">
            <Text className="text-ink-muted dark:text-ink-muted-dark">{t('matchFormat')}</Text>
            <Text className="font-bold text-ink dark:text-ink-dark">{matchFormatSummary(matchFormat, t)}</Text>
          </HStack>
          <HStack className="justify-between">
            <Text className="text-ink-muted dark:text-ink-muted-dark">{t('singleDeuce')}</Text>
            <Text className="font-bold text-ink dark:text-ink-dark">{singleDeuce ? t('sessionConfigOn') : t('sessionConfigOff')}</Text>
          </HStack>
        </VStack>
      </Box>

      <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionConfigEditHint')}</Text>

      {canEdit && (
        <Button variant="outline" size="lg" className="w-full" isDisabled={busy} onPress={onEdit}>
          <ButtonText variant="outline">{t('sessionEdit')}</ButtonText>
        </Button>
      )}
    </VStack>
  );
}
