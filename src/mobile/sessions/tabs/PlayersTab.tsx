import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../../../design-system/ui/Icon';
import { Badge } from '../../../design-system/ui/Badge';
import { IconButton } from '../../../design-system/ui/IconButton';
import { PlayerCard } from '../../../design-system/domain-ui/PlayerCard';
import { PlayerCircle } from '../../../design-system/domain-ui/PlayerCircle';
import { Box, HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Button, ButtonText } from '../../../../components/ui/button';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import { paymentStatus } from '../SessionPayment';
import { initialsFromName } from '../../../core/initials';
import type { Session, SessionParticipant } from '../../../core/api/types';

type RowAction = { label: string; onPress: () => void };

type Props = {
  session: Session;
  participants: SessionParticipant[];
  myUserId?: string;
  isOwnerOrAdmin: boolean;
  isSessionActive: boolean;
  canAddParticipant: boolean;
  placeholderCount: number;
  busy: boolean;
  /** The caller's own join / check-in area (MyParticipation). */
  myParticipation: ReactNode;
  /** Priced Session: amount, bank accounts and the viewer's payment. */
  paymentSummary?: ReactNode;
  onOpenProfile: (p: SessionParticipant) => void;
  /** Anyone opens a player's sheet: profile, payment; organizers also
   *  Check in and Remove. */
  onOpenRowMenu: (p: SessionParticipant) => void;
  onApprove: (userId: string) => void;
  onAddParticipant: () => void;
};

export function PlayersTab({
  session,
  participants,
  myUserId,
  isOwnerOrAdmin,
  isSessionActive,
  canAddParticipant,
  placeholderCount,
  busy,
  myParticipation,
  paymentSummary,
  onOpenProfile,
  onOpenRowMenu,
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
  // On a priced Session a member who went through the payment step has a
  // Paid / Awaiting pill on the right — never the host or a guest (DP-012
  // v0.29.0, see paymentStatus); organizers also get the section's action (Check in, Approve)
  // and a ⋯ that opens the row sheet — the receipt, Confirm payment and
  // Remove.
  function renderParticipantCard(p: SessionParticipant, action?: RowAction) {
    const canRemove = isOwnerOrAdmin && isSessionActive;
    const status = paymentStatus(p, session);
    const hasPayment = status !== undefined;
    const hasRowMenu = isOwnerOrAdmin && (canRemove || hasPayment);
    const canAct = action && isOwnerOrAdmin && isSessionActive;
    const isGuest = !p.userId;
    const payment =
      status === 'paid' ? t('sessionPaymentStatusPaid') : status === 'awaiting' ? t('sessionPaymentStatusAwaiting') : undefined;
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
          initials={initialsFromName(p.displayName || p.username || p.guestName || '?')}
          subtitle={subtitle}
          isGuest={isGuest}
          trailing={
            payment || canAct || hasRowMenu ? (
              <HStack className="items-center gap-1">
                {payment && <Badge action={status === 'paid' ? 'ready' : 'draft'} text={payment} caps className="self-center" />}
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

  // A checked-in or confirmed player as a circle: the green check once
  // they've checked in; under the name, their payment on a priced Session
  // (Paid / Awaiting — never the host or a guest, DP-012 v0.29.0), else
  // "Host" or "Guest".
  function renderParticipantCircle(p: SessionParticipant) {
    const status = paymentStatus(p, session);
    const isGuest = !p.userId;
    const isHost = Boolean(p.userId) && p.userId === session.createdBy;
    const caption =
      status === 'paid'
        ? t('sessionPaymentStatusPaid')
        : status === 'awaiting'
          ? t('sessionPaymentStatusAwaiting')
          : isHost
            ? t('sessionHostLabel')
            : isGuest
              ? t('sessionAddParticipantGuestOption')
              : undefined;
    const name = p.displayName || p.username || p.guestName || '?';
    return (
      <PlayerCircle
        key={p.id}
        name={p.userId === myUserId ? t('sessionYou') : name}
        initials={initialsFromName(name)}
        isGuest={isGuest}
        checkedIn={p.status === 'checked_in'}
        caption={caption}
        captionTone={status === 'paid' ? 'success' : status === 'awaiting' ? 'warning' : 'muted'}
        onPress={() => onOpenRowMenu(p)}
        accessibilityLabel={[name, participantStatusLabel(p.status), caption].filter(Boolean).join(', ')}
      />
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

        {/* Who's playing: checked-in and confirmed players as circles, in
            one grid with the open spots. Every player — the host too — opens
            their sheet; organizers get Check in and Remove there. */}
        {checkedInParticipants.length + confirmedParticipants.length + placeholderCount > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', rowGap: 16, columnGap: 12 }}>
            {[...checkedInParticipants, ...confirmedParticipants].map(renderParticipantCircle)}
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
          </View>
        )}

        {renderParticipantSection(t('sessionSectionWaitlist'), waitlistParticipants)}
        {renderParticipantSection(t('sessionSectionRequested'), requestedParticipants, (p) => ({
          label: t('sessionApprove'),
          onPress: () => onApprove(p.userId!),
        }))}
        {renderParticipantSection(t('sessionSectionCancelled'), cancelledParticipants)}
        {renderParticipantSection(t('sessionSectionOther'), otherParticipants)}

      </VStack>
    </VStack>
  );
}
