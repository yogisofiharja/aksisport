import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useFocusEffect } from '@react-navigation/native';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Badge } from '../../design-system/ui/Badge';
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
import { weekdayLong } from './weekday';
import { formatDateTime } from '../../core/sessions/sessionSchedule';
import { AppBar } from '../../design-system/layout/AppBar';

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
  const { t, lang } = useTranslation();
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
      <Page appBar={<AppBar onBack={onBack} />}>
        <Loading fullScreen />
      </Page>
    );
  }

  return (
    <ScrollPage appBar={<AppBar title={schedule.name || schedule.sport} context={t('sessionRecurringEvery', weekdayLong(schedule.recurrenceRule.weekday, lang))} onBack={onBack} />}>
      <HStack className="items-center flex-wrap" space="sm">
        <Badge
          action={schedule.status === 'paused' ? 'muted' : 'success'}
          text={schedule.status === 'paused' ? t('recurringScheduleStatusPaused') : t('recurringScheduleStatusActive')}
        />
        <Typography variant="body" color="muted">
          {[schedule.recurrenceRule.time, schedule.location].filter(Boolean).join(' · ')}
        </Typography>
      </HStack>

      <ListGroup>
        <ListRow icon="create-outline" title={t('recurringScheduleEdit')} chevron onPress={busy ? undefined : onEdit} />
        <ListRow
          icon={schedule.status === 'paused' ? 'play-outline' : 'pause-outline'}
          title={schedule.status === 'paused' ? t('recurringScheduleResume') : t('recurringSchedulePause')}
          subtitle={schedule.status === 'paused' ? undefined : t('recurringSchedulePauseHint')}
          onPress={busy ? undefined : handleTogglePause}
        />
      </ListGroup>

      <VStack space="sm">
        <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">
          {t('recurringScheduleUpcomingTitle')}
        </Text>
        {occurrences.length === 0 ? (
          <Typography variant="body" color="muted">
            {t('recurringScheduleNoUpcoming')}
          </Typography>
        ) : (
          <ListGroup>
            {occurrences.map((occurrence) => (
              <ListRow
                key={occurrence.startsAt}
                icon={occurrence.status === 'generated' ? 'checkmark-circle-outline' : occurrence.status === 'skipped' ? 'remove-circle-outline' : 'time-outline'}
                iconTone={occurrence.status === 'generated' ? 'success' : 'neutral'}
                title={formatDateTime(occurrence.startsAt, lang)}
                subtitle={occurrenceStatusLabel(occurrence.status, t)}
                trailing={
                  <HStack space="xs">
                    {occurrence.status === 'pending' && (
                      <RowAction label={t('recurringScheduleGenerate')} disabled={busy} onPress={() => handleGenerate(occurrence.startsAt)} />
                    )}
                    {occurrence.status !== 'skipped' && (
                      <RowAction label={t('recurringScheduleSkip')} destructive disabled={busy} onPress={() => handleSkip(occurrence.startsAt)} />
                    )}
                  </HStack>
                }
              />
            ))}
          </ListGroup>
        )}
      </VStack>

      <Pressable className="items-center py-3 active:opacity-60" onPress={handleDelete} disabled={busy}>
        <Text className="text-[15px] font-sans-bold text-danger dark:text-danger-dark">{t('recurringScheduleDelete')}</Text>
      </Pressable>
    </ScrollPage>
  );
}

// A small pill button at the end of an occurrence row.
function RowAction({ label, destructive, disabled, onPress }: { label: string; destructive?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="px-3 py-1.5 rounded-full border border-border dark:border-border-dark active:opacity-60"
    >
      <Text className={`text-sm font-sans-bold ${destructive ? 'text-danger dark:text-danger-dark' : 'text-ink dark:text-ink-dark'}`}>{label}</Text>
    </Pressable>
  );
}
