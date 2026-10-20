import { Box, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Button, ButtonText } from '../../../../components/ui/button';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import type { Session, SessionParticipant } from '../../../core/api/types';

type Props = {
  session: Session;
  myParticipant?: SessionParticipant;
  isPublished: boolean;
  isSessionActive: boolean;
  checkInWindowOpen: boolean;
  busy: boolean;
  strictLevelBlocked: boolean;
  /** Set when the caller has a level for the Session's sport. */
  hasMyLevel: boolean;
  minLevelName?: string;
  maxLevelName?: string;
  onRequestToJoin: () => void;
  onCheckIn: () => void;
  onCancelMyParticipation: () => void;
  onCheckOut: () => void;
};

// The caller's own place in this Session — ask to join, the state of
// their request, check in, or give up their spot. Shown on the Details
// tab (where the Session opens) and on Participants, so joining never
// depends on finding the right tab.
//
// DP-002 Join Approval: requested -> waitlist (needs payment) ->
// registered (approved) -> checked_in. Only 'registered', within
// the Check-In Window, can self check-in. Nothing here renders
// while still Draft — check-in status/actions only make sense
// once the Session is published. Every non-terminal status below
// 'Checked In' status itself is already visible on the caller's
// own avatar in the Participants list, so this area stays a
// small Check Out link rather than repeating a "Checked In"
// banner. Cancel/Check Out are self-service (DP-002) — give up
// the queue spot voluntarily, the participant's own counterpart
// to the organizer's Remove action.
export function MyParticipation({
  session,
  myParticipant,
  isPublished,
  isSessionActive,
  checkInWindowOpen,
  busy,
  strictLevelBlocked,
  hasMyLevel,
  minLevelName,
  maxLevelName,
  onRequestToJoin,
  onCheckIn,
  onCancelMyParticipation,
  onCheckOut,
}: Props) {
  const { t } = useTranslation();
  if (!isPublished) return null;
  return myParticipant?.status === 'checked_in' ? (
    isSessionActive ? (
      <Pressable className="items-center py-1 self-center active:opacity-60" onPress={onCheckOut} disabled={busy}>
        <Text className="text-ink-muted dark:text-ink-muted-dark font-bold text-sm">{t('sessionCheckOut')}</Text>
      </Pressable>
    ) : null
  ) : myParticipant?.status === 'requested' ? (
    <VStack className="gap-2">
      <Box className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-2xl p-4 items-center">
        <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionRequestedNotice')}</Text>
      </Box>
      <Pressable className="items-center py-1 active:opacity-60" onPress={onCancelMyParticipation} disabled={busy}>
        <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
      </Pressable>
    </VStack>
  ) : myParticipant?.status === 'waitlist' ? (
    <VStack className="gap-2">
      <Box className="bg-heat-tint dark:bg-heat-tint-dark rounded-2xl p-4 items-center">
        <Text className="text-sm text-ink dark:text-ink-dark">{t('sessionWaitlistedNotice')}</Text>
      </Box>
      <Pressable className="items-center py-1 active:opacity-60" onPress={onCancelMyParticipation} disabled={busy}>
        <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
      </Pressable>
    </VStack>
  ) : myParticipant?.status === 'registered' ? (
    isSessionActive ? (
      <VStack className="gap-2">
        {checkInWindowOpen ? (
          <Button size="xl" className="w-full" isDisabled={busy} onPress={onCheckIn}>
            <ButtonText>{t('sessionCheckIn')}</ButtonText>
          </Button>
        ) : (
          <Box className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-2xl p-4 items-center">
            <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionCheckInWindowClosed')}</Text>
          </Box>
        )}
        <Pressable className="items-center py-1 active:opacity-60" onPress={onCancelMyParticipation} disabled={busy}>
          <Text className="text-red-500 font-bold text-sm">{t('sessionCancelMyParticipation')}</Text>
        </Pressable>
      </VStack>
    ) : null
  ) : // Never joined, or cancelled their own spot earlier — either way they
  // can ask (again).
  (!myParticipant || myParticipant.status === 'cancelled') && isSessionActive ? (
    <VStack className="gap-2">
      <Button size="xl" className="w-full" isDisabled={busy || strictLevelBlocked} onPress={onRequestToJoin}>
        <ButtonText>{t('sessionRequestToJoin')}</ButtonText>
      </Button>
      {strictLevelBlocked && (
        <Text className="text-sm text-red-500">
          {hasMyLevel
            ? t('skillLevelStrictBlockedOutOfRange', minLevelName ?? '', maxLevelName ?? '')
            : t('skillLevelStrictBlockedNotSet', session.sport)}
        </Text>
      )}
    </VStack>
  ) : null;
}
