import type { ReactNode } from 'react';
import { Icon } from '../../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Button, ButtonText } from '../../../../components/ui/button';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import { formatIDR } from '../../../core/currency';
import { initialsFromName } from '../../../core/initials';
import { minParticipants } from '../../../sports/tennis/rules';
import { weekdayLabel } from '../../recurringSchedules/weekday';
import { activityTypeLabel } from '../sessionDisplay';
import type { RecurringSchedule, Session, SkillLevel } from '../../../core/api/types';

type Props = {
  session: Session;
  /** The Community row that starts the tab (DP-028). */
  communityRow: ReactNode;
  recurringSchedule: RecurringSchedule | null;
  minLevel?: SkillLevel;
  maxLevel?: SkillLevel;
  hasLevelRequirement: boolean;
  organizerName: string;
  isMeOrganizer: boolean;
  /** "Thu 22 Oct · 19:00", as on the cards. */
  dateText?: string;
  isOwnerOrAdmin: boolean;
  busy: boolean;
  /** The caller's own join / check-in area (MyParticipation). */
  myParticipation: ReactNode;
  onOpenPlayers: () => void;
  onPublish: () => void;
  onDiscard: () => void;
};

export function DetailsTab({
  session,
  communityRow,
  recurringSchedule,
  minLevel,
  maxLevel,
  hasLevelRequirement,
  organizerName,
  isMeOrganizer,
  dateText,
  isOwnerOrAdmin,
  busy,
  myParticipation,
  onOpenPlayers,
  onPublish,
  onDiscard,
}: Props) {
  const { t } = useTranslation();
  return (
    <VStack className="gap-5">
      {communityRow}
      <VStack className="gap-1">
        {recurringSchedule && (
          <HStack className="items-center gap-1">
            <Icon name="repeat-outline" size="xs" color="muted" />
            <Text className="text-ink-muted dark:text-ink-muted-dark">
              {t('sessionRecurringEvery', weekdayLabel(recurringSchedule.recurrenceRule.weekday, t))}
            </Text>
          </HStack>
        )}
        {session.lifecycleStatus === 'draft' && (
          <VStack className="gap-1.5 mb-1">
            <Box className="bg-info-tint dark:bg-info-tint-dark rounded-full px-2.5 py-1 self-start">
              <Text className="text-xs font-extrabold text-info dark:text-info-dark tracking-wide">
                {t('sessionStatusDraft').toUpperCase()}
              </Text>
            </Box>
            <Text className="text-sm text-ink dark:text-ink-dark">{t('sessionDraftNotice')}</Text>
          </VStack>
        )}
        {session.location && (
          <HStack className="items-center gap-1">
            <Icon name="location-outline" size="xs" color="muted" />
            <Text className="text-ink-muted dark:text-ink-muted-dark">{session.location}</Text>
          </HStack>
        )}
        {hasLevelRequirement && (
          <Text className="text-sm font-bold text-heat-strong dark:text-heat-strong-dark">
            {(minLevel?.name ?? '?') + '–' + (maxLevel?.name ?? '?')} ·{' '}
            {session.skillLevelEnforcement === 'strict' ? t('skillLevelEnforcementStrict') : t('skillLevelEnforcementGuidance')}
          </Text>
        )}
      </VStack>

      {myParticipation}

      <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
        <VStack className="gap-2">
          <HStack className="justify-between">
            <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionSportLabel')}</Text>
            <Text className="font-bold text-ink dark:text-ink-dark">{session.sport === 'tennis' ? t('sportTennis') : session.sport}</Text>
          </HStack>
          {session.activityType && (
            <HStack className="justify-between">
              <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionActivityTypeLabel')}</Text>
              <Text className="font-bold text-ink dark:text-ink-dark">{activityTypeLabel(session.activityType, t)}</Text>
            </HStack>
          )}
          {dateText && (
            <HStack className="justify-between">
              <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionDateLabel')}</Text>
              <Text className="font-bold text-ink dark:text-ink-dark">{dateText}</Text>
            </HStack>
          )}
          {session.durationMinutes != null && (
            <HStack className="justify-between">
              <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionDurationLabel')}</Text>
              <Text className="font-bold text-ink dark:text-ink-dark">{t('sessionDurationHours', Math.round(session.durationMinutes / 60))}</Text>
            </HStack>
          )}
          {session.priceModel === 'free' ? (
            <HStack className="justify-between">
              <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionPriceLabel')}</Text>
              <Text className="font-bold text-ink dark:text-ink-dark">{t('sessionPriceFreeDisplay')}</Text>
            </HStack>
          ) : session.priceModel === 'per_person' ? (
            <HStack className="justify-between">
              <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionPriceLabel')}</Text>
              <Text className="font-bold text-ink dark:text-ink-dark">
                {session.pricePerPerson != null ? t('sessionPricePerPersonDisplay', formatIDR(session.pricePerPerson)) : '—'}
              </Text>
            </HStack>
          ) : (
            session.totalPrice != null && (
              <>
                <HStack className="justify-between">
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionSplitBillTotalLabel')}</Text>
                  <Text className="font-bold text-ink dark:text-ink-dark">{formatIDR(session.totalPrice)}</Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionSplitBillPerPersonLabel', session.joinedCount)}</Text>
                  <Text className="font-bold text-ink dark:text-ink-dark">
                    {session.joinedCount > 0 ? formatIDR(Math.round(session.totalPrice / session.joinedCount)) : '—'}
                  </Text>
                </HStack>
              </>
            )
          )}
        </VStack>
      </Box>

      <Pressable onPress={onOpenPlayers} className="bg-surface dark:bg-surface-dark rounded-2xl p-4 active:opacity-70">
        <HStack className="justify-between items-center">
          <Text className="font-bold text-ink dark:text-ink-dark">
            {session.maxParticipants != null
              ? t('sessionJoinedCountLineMax', session.joinedCount, session.maxParticipants)
              : t('sessionJoinedCountLine', session.joinedCount)}
          </Text>
          <Icon name="chevron-forward" size="sm" color="muted" />
        </HStack>
      </Pressable>

      {session.description && (
        <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-1">
          <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">
            {t('sessionDescriptionSectionTitle')}
          </Text>
          <Text className="text-ink-muted dark:text-ink-muted-dark">{session.description}</Text>
        </Box>
      )}

      {/* Lifecycle framing (Milestone 2) — session.lifecycleStatus is
          resolved server-side (DP-001/DP-ARCH-003), covers every stage:
          Draft -> Recruiting/Ready/Full -> Live -> Completed, Cancelled
          from any non-terminal state. */}
      {(session.lifecycleStatus === 'recruiting' || session.lifecycleStatus === 'ready' || session.lifecycleStatus === 'full') && (
        <Box className="bg-info-tint dark:bg-info-tint-dark rounded-xl p-4">
          <Text className="text-sm text-ink dark:text-ink-dark">
            {session.lifecycleStatus === 'recruiting'
              ? t('sessionRecruitingNotice', session.joinedCount, minParticipants('single'))
              : session.lifecycleStatus === 'ready'
                ? // "Start whenever you're ready" is the organizer's call.
                  isOwnerOrAdmin
                  ? t('sessionReadyNotice')
                  : t('sessionReadyNoticePlayer')
                : t('sessionFullNotice')}
          </Text>
        </Box>
      )}

      {/* No manual "Complete Session" action — DP-009's auto-transition
          (starts_at + duration_minutes elapses) is the only path to
          Completed, by explicit product decision. */}
      {session.lifecycleStatus === 'in_progress' && (
        <Box className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
          <HStack className="items-center gap-1.5">
            <Box className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <Text className="text-xs font-extrabold text-red-500 tracking-wide">{t('sessionLiveNotice').toUpperCase()}</Text>
          </HStack>
        </Box>
      )}

      {session.lifecycleStatus === 'completed' && (
        <Box className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-2xl p-4">
          <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionCompletedNotice')}</Text>
        </Box>
      )}

      {session.lifecycleStatus === 'cancelled' && (
        <Box className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
          <Text className="text-sm text-red-800 dark:text-red-300">{t('sessionCancelledNotice')}</Text>
        </Box>
      )}

      {/* Organizer is session.createdBy — shown separately from Participants
          regardless of whether they're also playing (hostPlaying). */}
      <VStack className="gap-2">
        <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{t('sessionOrganizerTitle')}</Text>
        <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
          <VStack className="items-center" style={{ width: 76 }}>
            <Box className="w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-border dark:border-border-dark">
              <Text className="text-base font-extrabold text-ink-muted dark:text-ink-muted-dark">{initialsFromName(organizerName)}</Text>
            </Box>
            <Text className="text-xs font-bold text-ink dark:text-ink-dark text-center mt-1" numberOfLines={2}>
              {organizerName}
              {isMeOrganizer ? ` (${t('sessionYou')})` : ''}
            </Text>
          </VStack>
        </HStack>
      </VStack>

      {/* DP-001: a draft session is invisible to members until published.
          Publish stays inline: it's the primary action while reviewing a
          Draft, not something to bury. Discard also stays inline —
          Draft-only, a low-prominence text link. */}
      {isOwnerOrAdmin && session.lifecycleStatus === 'draft' && (
        <VStack className="gap-3">
          <Button size="lg" className="w-full" isDisabled={busy} onPress={onPublish}>
            <ButtonText>{t('sessionPublish')}</ButtonText>
          </Button>

          <Box className="h-px bg-surface-sunken dark:bg-surface-sunken-dark my-1" />

          <Pressable className="items-center py-2 active:opacity-60" onPress={onDiscard} disabled={busy}>
            <Text className="text-red-500 font-bold">{t('sessionDiscard')}</Text>
          </Pressable>
        </VStack>
      )}
    </VStack>
  );
}
