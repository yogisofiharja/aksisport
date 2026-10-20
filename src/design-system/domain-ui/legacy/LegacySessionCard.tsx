// Legacy: the pre-redesign card, kept so screens look unchanged while the
// redesigned card (../SessionCard) waits for review in the Component Gallery.
// Removed when the screens swap to the new card.

import { Card } from '../../ui/Card';
import { Badge, type BadgeAction } from '../../ui/Badge';
import { Typography } from '../../ui/Typography';
import { HStack } from '../../layout/HStack';
import { VStack } from '../../layout/VStack';

/**
 * Matches SessionListScreen's existing session row (title, optional
 * location, status pill, date/time, capacity). The status pill is
 * color-coded by the caller via `statusAction` (v0.7.1) — draft/open/
 * in_progress/completed/cancelled each get a distinct color so they're
 * distinguishable at a glance, not just by their text label. Capacity
 * (joined/max) is colored independently: green while spots remain, red
 * once full.
 *
 * Typography uses `className` overrides on `variant="body"`, not
 * `title`/`label` — same bug as ClubCard had, same fix, caught in the same
 * pass: the original title is `text-lg font-bold` (18px/700), not
 * `title`'s `text-2xl font-black`; the subtitle is `text-sm text-ink-muted dark:text-ink-muted-dark`
 * (regular weight), not `label`'s `text-sm font-bold`.
 */

type SessionCardProps = {
  title: string;
  subtitle?: string; // location
  dateTime?: string; // formatted date + time
  status?: string;
  statusAction?: BadgeAction;
  joinedCount?: number;
  maxParticipants?: number;
  onPress?: () => void;
  className?: string;
};

export function LegacySessionCard({
  title,
  subtitle,
  dateTime,
  status,
  statusAction = 'muted',
  joinedCount,
  maxParticipants,
  onPress,
  className = '',
}: SessionCardProps) {
  const hasCapacity = joinedCount != null;
  const isFull = hasCapacity && maxParticipants != null && joinedCount >= maxParticipants;
  const capacityLabel = hasCapacity ? (maxParticipants != null ? `${joinedCount}/${maxParticipants}` : `${joinedCount}`) : undefined;

  return (
    <Card pressable={Boolean(onPress)} onPress={onPress} className={className}>
      <HStack className="justify-between items-center" space="md">
        <VStack space="xs" style={{ flex: 1 }}>
          <Typography variant="body" color="default" className="text-lg font-bold" numberOfLines={1}>
            {title}
          </Typography>
          {dateTime && (
            <Typography variant="body" color="muted" className="text-sm">
              {dateTime}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body" color="muted" className="text-sm">
              {subtitle}
            </Typography>
          )}
        </VStack>
        <VStack space="xs" style={{ alignItems: 'flex-end' }}>
          {status && <Badge action={statusAction} text={status} />}
          {capacityLabel && <Badge action={isFull ? 'error' : 'success'} text={capacityLabel} />}
        </VStack>
      </HStack>
    </Card>
  );
}
