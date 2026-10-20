// Legacy: the pre-redesign card, kept so screens look unchanged while the
// redesigned card (../RecurringScheduleCard) waits for review in the Component Gallery.
// Removed when the screens swap to the new card.

import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Typography } from '../../ui/Typography';
import { HStack } from '../../layout/HStack';
import { VStack } from '../../layout/VStack';

type RecurringScheduleCardProps = {
  title: string;
  subtitle?: string; // weekday + time
  statusLabel: string;
  isPaused: boolean;
  onPress?: () => void;
  className?: string;
};

export function LegacyRecurringScheduleCard({
  title,
  subtitle,
  statusLabel,
  isPaused,
  onPress,
  className = '',
}: RecurringScheduleCardProps) {
  return (
    <Card pressable={Boolean(onPress)} onPress={onPress} className={className}>
      <HStack className="justify-between items-center" space="md">
        <VStack space="xs" style={{ flex: 1 }}>
          <Typography variant="body" color="default" className="text-lg font-bold" numberOfLines={1}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body" color="muted" className="text-sm">
              {subtitle}
            </Typography>
          )}
        </VStack>
        <Badge action={isPaused ? 'muted' : 'success'} text={statusLabel} />
      </HStack>
    </Card>
  );
}
