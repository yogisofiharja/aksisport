import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar } from '../../../design-system/layout/AppBar';
import { SummaryCard } from '../../../design-system/domain-ui/SummaryCard';
import { Button, ButtonText } from '../../../design-system/ui/Button';
import { FieldError } from '../../../design-system/ui/Field';
import { Typography } from '../../../design-system/ui/Typography';
import { useTranslation } from '../../../i18n';
import { firstScheduledSession } from '../../../core/recurringSchedules/firstSession';
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
  onCreate: () => void;
  onDiscard: () => void;
};

// "Saturday", in the app's language.
function longWeekday(d: Date, lang: 'en' | 'id') {
  return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long' });
}

// Check your schedule (DP-007 v0.28.0; Aksi redesign › Recurring preview):
// the Schedule read back as a WEEKLY card before it is created. No draft —
// its Sessions are published on their own — so the actions are Create
// schedule and Discard (which asks first). Back keeps the form.
export function ScheduleCheck({ values: v, clubName, levels, submitting, error, onBack, onCreate, onDiscard }: Props) {
  const { t, lang } = useTranslation();
  const insets = useSafeAreaInsets();
  const first = firstScheduledSession(v.weekday, v.time.getHours(), v.time.getMinutes(), v.leadDays);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar title={t('scheduleCheckTitle')} context={clubName || undefined} onBack={onBack} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <SummaryCard
          tag={t('scheduleCheckTag')}
          title={v.name.trim()}
          rows={[
            { label: t('checkActivity'), value: activityValue(v, t) },
            { label: t('checkEvery'), value: `${longWeekday(first.startsAt, lang)} · ${timeRange(v.time, v.durationHours)}` },
            { label: t('checkWhere'), value: v.location.trim() },
            { label: t('checkOpens'), value: t('checkOpensDaysAhead', v.leadDays, longWeekday(first.opensAt, lang)) },
            { label: t('checkFirstSession'), value: shortDate(first.startsAt, lang) },
            { label: t('checkPlayers'), value: playersValue(v, t) },
            { label: t('checkMatchFormat'), value: matchFormatValue(v, t) },
            { label: t('checkSkillLevel'), value: skillValue(v, levels, t) },
            { label: t('checkPrice'), value: priceValue(v, t) },
          ]}
        />
        <Typography variant="label" color="muted" className="font-sans">
          {t('scheduleCheckNote')}
        </Typography>
      </ScrollView>
      <View
        className="px-4 pt-3 gap-2.5 bg-ground dark:bg-ground-dark border-t border-border dark:border-border-dark"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        {error ? <FieldError>{error}</FieldError> : null}
        <Button size="lg" loading={submitting} isDisabled={submitting} onPress={onCreate}>
          <ButtonText>{t('scheduleCreate')}</ButtonText>
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
