import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../../components/ui/button';
import { Box, VStack, HStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Pressable } from '../../../../components/ui/pressable';
import { AppBar } from '../../../design-system/layout/AppBar';
import { useTranslation } from '../../../i18n';
import { formatIDR } from '../../../core/currency';
import { matchFormatSummary } from '../../../core/sessions/matchFormatSummary';
import { formatSessionDateTime } from '../../../core/sessions/sessionSchedule';
import { combinedStartsAt, type SessionFormValues } from '../../../core/sessions/sessionForm';
import type { SkillLevel } from '../../../core/api/types';
import { activityTypeLabel, sportLabel } from '../sessionDisplay';

type Props = {
  values: SessionFormValues;
  clubName: string;
  levels: SkillLevel[];
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack className="justify-between">
      <Text className="text-ink-muted dark:text-ink-muted-dark">{label}</Text>
      <Text className="font-bold text-ink dark:text-ink-dark">{value}</Text>
    </HStack>
  );
}

// Milestone 2 — the ad-hoc Session's preview step: nothing is saved until
// Publish or Save as Draft.
export function SessionCheck({ values: v, levels, submitting, error, onBack, onPublish, onSaveDraft, onDiscard }: Props) {
  const { t } = useTranslation();
  const levelName = (id?: string) => levels.find((l) => l.id === id)?.name ?? t('skillLevelNotSet');
  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar title={t('sessionPreviewTitle')} onBack={onBack} />
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
        <Text className="text-2xl font-black text-ink dark:text-ink-dark">{v.name.trim()}</Text>
        <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
          <VStack className="gap-2">
            <DetailRow label={t('sessionSportLabel')} value={sportLabel(v.sport, t)} />
            {v.activityType && <DetailRow label={t('sessionActivityTypeLabel')} value={activityTypeLabel(v.activityType, t)} />}
            <DetailRow label={t('sessionDateLabel')} value={formatSessionDateTime(combinedStartsAt(v.date, v.time).toISOString()) ?? ''} />
            <DetailRow label={t('sessionDurationLabel')} value={t('sessionDurationHours', v.durationHours)} />
            <DetailRow
              label={t('sessionPreviewMaxParticipantsLabel')}
              value={v.maxParticipants.trim() ? v.maxParticipants.trim() : t('sessionPreviewCapacityUnlimited')}
            />
            <DetailRow
              label={t('sessionPriceLabel')}
              value={
                v.priceModel === 'free'
                  ? t('sessionPriceFreeDisplay')
                  : v.priceModel === 'per_person'
                    ? t('sessionPricePerPersonDisplay', formatIDR(Number(v.pricePerPerson)))
                    : formatIDR(Number(v.totalPrice))
              }
            />
            <DetailRow label={t('matchFormat')} value={matchFormatSummary(v.matchFormat, t)} />
            {v.requireSkillLevel && (
              <DetailRow label={t('skillLevelRangeLabel')} value={`${levelName(v.skillLevelMinId)}–${levelName(v.skillLevelMaxId)}`} />
            )}
          </VStack>
        </Box>
        {error && <Text className="text-sm text-red-500">{error}</Text>}
        <VStack className="gap-3">
          <Button size="lg" className="w-full" isDisabled={submitting} onPress={onPublish}>
            <ButtonText>{t('sessionPublish')}</ButtonText>
          </Button>
          <Button variant="outline" size="lg" className="w-full" isDisabled={submitting} onPress={onSaveDraft}>
            <ButtonText variant="outline">{t('sessionSaveAsDraft')}</ButtonText>
          </Button>
          <Pressable className="items-center py-2 active:opacity-60" onPress={onDiscard} disabled={submitting}>
            <Text className="text-red-500 font-bold">{t('sessionDiscard')}</Text>
          </Pressable>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
