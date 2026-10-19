import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useFocusEffect } from '@react-navigation/native';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Badge } from '../../design-system/ui/Badge';
import { Card } from '../../design-system/ui/Card';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import {
  deleteRecurringSchedule,
  generateOccurrence,
  getRecurringSchedule,
  listOccurrences,
  pauseRecurringSchedule,
  resumeRecurringSchedule,
  skipOccurrence,
} from '../../core/recurringSchedules/api';
import type { OccurrencePreview, RecurringSchedule } from '../../core/api/types';
import { weekdayLabel } from './weekday';

type Props = {
  clubId: string;
  scheduleId: string;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
};

function occurrenceStatusLabel(status: OccurrencePreview['status'], t: (key: string) => string) {
  if (status === 'generated') return t('recurringScheduleOccurrenceGenerated');
  if (status === 'skipped') return t('recurringScheduleOccurrenceSkipped');
  return t('recurringScheduleOccurrencePending');
}

export function RecurringScheduleDetailScreen({ clubId, scheduleId, onBack, onEdit, onDeleted }: Props) {
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState<RecurringSchedule | null>(null);
  const [occurrences, setOccurrences] = useState<OccurrencePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [scheduleResult, occurrencesResult] = await Promise.all([
        getRecurringSchedule(clubId, scheduleId),
        listOccurrences(clubId, scheduleId),
      ]);
      setSchedule(scheduleResult);
      setOccurrences(occurrencesResult);
    } catch {
      // leave stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [clubId, scheduleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleTogglePause() {
    if (!schedule || busy) return;
    setBusy(true);
    try {
      const updated =
        schedule.status === 'paused'
          ? await resumeRecurringSchedule(clubId, scheduleId)
          : await pauseRecurringSchedule(clubId, scheduleId);
      setSchedule(updated);
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip(occurrenceStartsAt: string) {
    if (busy) return;
    setBusy(true);
    try {
      await skipOccurrence(clubId, scheduleId, occurrenceStartsAt);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate(occurrenceStartsAt: string) {
    if (busy) return;
    setBusy(true);
    try {
      await generateOccurrence(clubId, scheduleId, occurrenceStartsAt);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    appAlert(t('recurringScheduleDeleteConfirmTitle'), t('recurringScheduleDeleteConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteRecurringSchedule(clubId, scheduleId);
            onDeleted();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading || !schedule) {
    return (
      <Page>
        <Loading fullScreen />
      </Page>
    );
  }

  return (
    <ScrollPage>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <VStack space="xs">
        <Typography variant="heading">{schedule.name || schedule.sport}</Typography>
        <Typography variant="body" color="muted">
          {weekdayLabel(schedule.recurrenceRule.weekday, t)} {schedule.recurrenceRule.time}
          {schedule.location ? ` · ${schedule.location}` : ''}
        </Typography>
        <Badge
          action={schedule.status === 'paused' ? 'muted' : 'success'}
          text={schedule.status === 'paused' ? t('recurringScheduleStatusPaused') : t('recurringScheduleStatusActive')}
        />
      </VStack>

      <Button variant="outline" size="xl" className="w-full" onPress={onEdit} isDisabled={busy}>
        <ButtonText variant="outline">
          {t('recurringScheduleEdit')}
        </ButtonText>
      </Button>

      <Button variant="outline" size="xl" className="w-full" onPress={handleTogglePause} isDisabled={busy}>
        <ButtonText variant="outline">
          {schedule.status === 'paused' ? t('recurringScheduleResume') : t('recurringSchedulePause')}
        </ButtonText>
      </Button>

      <VStack space="sm">
        <Typography variant="title">{t('recurringScheduleUpcomingTitle')}</Typography>
        {occurrences.length === 0 ? (
          <Typography variant="body" color="muted">
            {t('recurringScheduleNoUpcoming')}
          </Typography>
        ) : (
          <VStack space="sm">
            {occurrences.map((occurrence) => (
              <Card key={occurrence.startsAt}>
                <HStack className="justify-between items-center" space="md">
                  <VStack space="xs" style={{ flex: 1 }}>
                    <Typography variant="body" className="font-bold">
                      {new Date(occurrence.startsAt).toLocaleString()}
                    </Typography>
                    <Badge action="muted" text={occurrenceStatusLabel(occurrence.status, t)} />
                  </VStack>
                  <HStack space="md">
                    {occurrence.status === 'pending' && (
                      <Pressable disabled={busy} onPress={() => handleGenerate(occurrence.startsAt)}>
                        <Typography variant="body" color="default" className="font-bold">
                          {t('recurringScheduleGenerate')}
                        </Typography>
                      </Pressable>
                    )}
                    {occurrence.status !== 'skipped' && (
                      <Pressable disabled={busy} onPress={() => handleSkip(occurrence.startsAt)}>
                        <Typography variant="body" color="destructive" className="font-bold">
                          {t('recurringScheduleSkip')}
                        </Typography>
                      </Pressable>
                    )}
                  </HStack>
                </HStack>
              </Card>
            ))}
          </VStack>
        )}
      </VStack>

      <Pressable className="items-center py-3" onPress={handleDelete} disabled={busy}>
        <Typography variant="body" color="destructive" className="font-bold">
          {t('recurringScheduleDelete')}
        </Typography>
      </Pressable>
    </ScrollPage>
  );
}
