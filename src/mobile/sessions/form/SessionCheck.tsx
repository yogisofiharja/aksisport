import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar } from '../../../design-system/layout/AppBar';
import { SummaryCard } from '../../../design-system/domain-ui/SummaryCard';
import { Button, ButtonText } from '../../../design-system/ui/Button';
import { FieldError } from '../../../design-system/ui/Field';
import { Typography } from '../../../design-system/ui/Typography';
import { useTranslation } from '../../../i18n';
import { shortDate, timeRange, type SessionFormValues } from '../../../core/sessions/sessionForm';
import type { SkillLevel } from '../../../core/api/types';
import { activityValue, matchFormatValue, playersValue, priceValue, skillValue } from './summaryRows';

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

// Check your session (Aksi redesign › Session preview): what was entered,
// read back as a DRAFT card, before anything is saved. Publish (primary),
// Save as draft (secondary), then Discard as red text, last — it asks
// first. Back returns to the form with everything kept.
export function SessionCheck({ values: v, clubName, levels, submitting, error, onBack, onPublish, onSaveDraft, onDiscard }: Props) {
  const { t, lang } = useTranslation();
  const insets = useSafeAreaInsets();
  const notes = v.description.trim();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar title={t('sessionCheckTitle')} context={clubName || undefined} onBack={onBack} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <SummaryCard
          tag={t('sessionStatusDraft').toUpperCase()}
          title={v.name.trim()}
          rows={[
            { label: t('checkActivity'), value: activityValue(v, t) },
            { label: t('checkWhen'), value: `${shortDate(v.date, lang)} · ${timeRange(v.time, v.durationHours)}` },
            { label: t('checkWhere'), value: v.location.trim() },
            { label: t('checkPlayers'), value: playersValue(v, t) },
            { label: t('checkMatchFormat'), value: matchFormatValue(v, t) },
            { label: t('checkSkillLevel'), value: skillValue(v, levels, t) },
            { label: t('checkPrice'), value: priceValue(v, t) },
            ...(notes ? [{ label: t('checkNotes'), value: notes }] : []),
          ]}
        />
        <Typography variant="label" color="muted" className="font-sans">
          {t('sessionCheckNote')}
        </Typography>
      </ScrollView>
      <View
        className="px-4 pt-3 gap-2.5 bg-ground dark:bg-ground-dark border-t border-border dark:border-border-dark"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        {error ? <FieldError>{error}</FieldError> : null}
        <Button size="lg" loading={submitting} isDisabled={submitting} onPress={onPublish}>
          <ButtonText>{t('sessionPublish')}</ButtonText>
        </Button>
        <Button size="lg" variant="outline" isDisabled={submitting} onPress={onSaveDraft}>
          <ButtonText>{t('sessionSaveAsDraft')}</ButtonText>
        </Button>
        <Pressable
          onPress={onDiscard}
          disabled={submitting}
          accessibilityRole="button"
          className="self-center px-3 py-2 active:opacity-60"
        >
          <Text className="text-[15px] font-sans-bold text-danger dark:text-danger-dark">{t('sessionDiscard')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
