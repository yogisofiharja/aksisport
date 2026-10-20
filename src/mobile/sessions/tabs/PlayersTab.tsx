import type { ReactNode } from 'react';
import { Icon } from '../../../design-system/ui/Icon';
import { Badge } from '../../../design-system/ui/Badge';
import { IconButton } from '../../../design-system/ui/IconButton';
import { PlayerCard } from '../../../design-system/domain-ui/PlayerCard';
import { Box, HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Button, ButtonText } from '../../../../components/ui/button';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import { hasPaid, isAwaitingPayment } from '../SessionPayment';
import type { Session, SessionParticipant } from '../../../core/api/types';

type RowAction = { label: string; onPress: () => void };

type Props = {
  session: Session;
  participants: SessionParticipant[];
  myUserId?: string;
  isOwnerOrAdmin: boolean;
  isSessionActive: boolean;
  checkInWindowOpen: boolean;
  canAddParticipant: boolean;
  placeholderCount: number;
  busy: boolean;
  /** The caller's own join / check-in area (MyParticipation). */
  myParticipation: ReactNode;
  /** Priced Session: amount, bank accounts and the viewer's payment. */
  paymentSummary?: ReactNode;
  onOpenProfile: (p: SessionParticipant) => void;
  /** An organizer's ⋯ on a row: payment and Remove. */
  onOpenRowMenu: (p: SessionParticipant) => void;
  onCheckInParticipant: (participantId: string) => void;
  onApprove: (userId: string) => void;
  onAddParticipant: () => void;
};

export function PlayersTab({
  session,
  participants,
  myUserId,
  isOwnerOrAdmin,
  isSessionActive,
  checkInWindowOpen,
  canAddParticipant,
  placeholderCount,
  busy,
  myParticipation,
  paymentSummary,
  onOpenProfile,
  onOpenRowMenu,
  onCheckInParticipant,
  onApprove,
  onAddParticipant,
}: Props) {
  const { t, lang } = useTranslation();

  // Milestone 2: split into sub-sections by status, each only rendered
  // when non-empty. checked_out/no_show have no dedicated action but are
  // shown rather than silently dropped.
  const checkedInParticipants = participants.filter((p) => p.status === 'checked_in');
  const confirmedParticipants = participants.filter((p) => p.status === 'registered');
  const waitlistParticipants = participants.filter((p) => p.status === 'waitlist');
  const requestedParticipants = participants.filter((p) => p.status === 'requested');
  const cancelledParticipants = participants.filter((p) => p.status === 'cancelled');
  const otherParticipants = participants.filter((p) => p.status === 'checked_out' || p.status === 'no_show');

  function participantStatusLabel(status: SessionParticipant['status']): string {
    if (status === 'checked_in') return t('sessionSectionCheckedIn');
    if (status === 'registered') return t('sessionSectionConfirmed');
    if (status === 'waitlist') return t('sessionSectionWaitlist');
    if (status === 'requested') return t('sessionSectionRequested');
    if (status === 'cancelled') return t('sessionSectionCancelled');
    return t('sessionSectionOther');
  }

  // One PlayerCard row per participant: initials (dashed for a guest), the
  // name, and a subline with their status (and "host" for the organizer).
  // On a priced Session the Paid / Awaiting pill sits on the right (DP-024,
  // DP-012); organizers also get the section's action (Check in, Approve)
  // and a ⋯ that opens the row sheet — the receipt, Confirm payment and
  // Remove.
  function renderParticipantCard(p: SessionParticipant, action?: RowAction) {
    const canRemove = isOwnerOrAdmin && isSessionActive;
    const hasPayment = session.priceModel !== 'free' && (hasPaid(p) || isAwaitingPayment(p));
    const hasRowMenu = isOwnerOrAdmin && (canRemove || hasPayment);
    const canAct = action && isOwnerOrAdmin && isSessionActive;
    const isGuest = !p.userId;
    const payment =
      session.priceModel !== 'free'
        ? hasPaid(p)
          ? t('sessionPaymentStatusPaid')
          : isAwaitingPayment(p)
            ? t('sessionPaymentStatusAwaiting')
            : undefined
        : undefined;
    // "Checked in · host": what follows the status is lowercase.
    const subtitle = [
      participantStatusLabel(p.status),
      ...[p.userId && p.userId === session.createdBy ? t('sessionHostLabel') : undefined, isGuest ? t('sessionAddParticipantGuestOption') : undefined]
        .filter(Boolean)
        .map((part) => part!.toLocaleLowerCase(lang)),
    ].join(' · ');
    return (
      // Organizers tap a member to see who they are (DP-019) — what they
      // need when deciding on a request to join.
      <Pressable
        key={p.id}
        disabled={!(isOwnerOrAdmin && p.userId)}
        onPress={() => onOpenProfile(p)}
        className="active:opacity-70"
        accessibilityLabel={isOwnerOrAdmin && p.userId ? t('playerProfileOpen') : undefined}
      >
        <PlayerCard
          name={`${p.displayName || p.username || p.guestName}${p.userId === myUserId ? ` (${t('sessionYou')})` : ''}`}
          subtitle={subtitle}
          isGuest={isGuest}
          trailing={
            payment || canAct || hasRowMenu ? (
              <HStack className="items-center gap-1">
                {payment && <Badge action={hasPaid(p) ? 'ready' : 'draft'} text={payment} caps className="self-center" />}
                {canAct && (
                  <Button size="sm" isDisabled={busy} onPress={action.onPress}>
                    <ButtonText>{action.label}</ButtonText>
                  </Button>
                )}
                {hasRowMenu && <IconButton icon="ellipsis-horizontal" size="md" label={t('appBarMore')} onPress={() => onOpenRowMenu(p)} />}
              </HStack>
            ) : undefined
          }
        />
      </Pressable>
    );
  }

  function renderParticipantSection(label: string, list: SessionParticipant[], action?: (p: SessionParticipant) => RowAction) {
    if (list.length === 0) return null;
    return (
      <VStack className="gap-2">
        <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark">{label}</Text>
        <VStack className="gap-2">{list.map((p) => renderParticipantCard(p, action?.(p)))}</VStack>
      </VStack>
    );
  }

  return (
    <VStack className="gap-5">
      {paymentSummary}

      {myParticipation}

      <VStack className="gap-4">
        <HStack className="justify-between items-center">
          <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">
            {t('sessionParticipantsTitle')}
          </Text>
          <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark">
            {session.maxParticipants != null ? `${session.joinedCount}/${session.maxParticipants}` : session.joinedCount}
          </Text>
        </HStack>

        {renderParticipantSection(t('sessionSectionCheckedIn'), checkedInParticipants)}
        {renderParticipantSection(
          t('sessionSectionConfirmed'),
          confirmedParticipants,
          checkInWindowOpen ? (p) => ({ label: t('sessionCheckIn'), onPress: () => onCheckInParticipant(p.id) }) : undefined
        )}
        {renderParticipantSection(t('sessionSectionWaitlist'), waitlistParticipants)}
        {renderParticipantSection(t('sessionSectionRequested'), requestedParticipants, (p) => ({
          label: t('sessionApprove'),
          onPress: () => onApprove(p.userId!),
        }))}
        {renderParticipantSection(t('sessionSectionCancelled'), cancelledParticipants)}
        {renderParticipantSection(t('sessionSectionOther'), otherParticipants)}

        {placeholderCount > 0 && (
          <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <VStack key={`placeholder-${i}`} className="items-center" style={{ width: 76 }}>
                {/* An open spot. Organizers can tap it to add someone (hence
                    the "+"); for everyone else it only shows how many spots
                    are left, so it carries no "+" and does nothing. */}
                {canAddParticipant ? (
                  <Pressable
                    onPress={onAddParticipant}
                    className="w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-dashed border-border-strong dark:border-border-strong-dark active:opacity-70"
                    accessibilityLabel={t('sessionAddParticipantTitle')}
                  >
                    <Icon name="add" size="md" color="muted" />
                  </Pressable>
                ) : (
                  <Box className="w-16 h-16 rounded-full border-2 border-dashed border-border dark:border-border-dark" accessibilityLabel={t('sessionOpenSpot')} />
                )}
              </VStack>
            ))}
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}
