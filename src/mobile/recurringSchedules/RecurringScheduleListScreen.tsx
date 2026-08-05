import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { RecurringScheduleCard } from '../../design-system/domain-ui/RecurringScheduleCard';
import { useTranslation } from '../../i18n';
import { listRecurringSchedules } from '../../core/recurringSchedules/api';
import type { RecurringSchedule } from '../../core/api/types';
import { weekdayLabel } from './weekday';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenSchedule: (scheduleId: string) => void;
  onCreateSchedule: () => void;
};

export function RecurringScheduleListScreen({ clubId, onBack, onOpenSchedule, onCreateSchedule }: Props) {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSchedules(await listRecurringSchedules(clubId));
    } catch {
      // keep stale list; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <Typography variant="display">{t('recurringScheduleListTitle')}</Typography>

      {loading && schedules.length === 0 ? (
        <Loading />
      ) : schedules.length === 0 ? (
        <EmptyState message={t('recurringScheduleEmptyState')} />
      ) : (
        <VStack space="md">
          {schedules.map((schedule) => (
            <RecurringScheduleCard
              key={schedule.id}
              title={schedule.name || schedule.sport}
              subtitle={`${weekdayLabel(schedule.recurrenceRule.weekday, t)} ${schedule.recurrenceRule.time}`}
              statusLabel={schedule.status === 'paused' ? t('recurringScheduleStatusPaused') : t('recurringScheduleStatusActive')}
              isPaused={schedule.status === 'paused'}
              onPress={() => onOpenSchedule(schedule.id)}
            />
          ))}
        </VStack>
      )}

      <Button action="secondary" size="xl" className="w-full" onPress={onCreateSchedule}>
        <ButtonText className="text-lg">{t('recurringScheduleCreate')}</ButtonText>
      </Button>
    </ScrollPage>
  );
}
