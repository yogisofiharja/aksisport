import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../../../design-system/ui/Icon';
import { PlayerCircle } from '../../../design-system/domain-ui/PlayerCircle';
import { Box, HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import { paymentStatus } from '../SessionPayment';
import { initialsFromName } from '../../../core/initials';
import type { ParticipantStatus, Session, SessionParticipant } from '../../../core/api/types';

type Props = {
  session: Session;
  participants: SessionParticipant[];
  myUserId?: string;
  isOwnerOrAdmin: boolean;
  canAddParticipant: boolean;
  placeholderCount: number;
  /** The caller's own join / check-in area (MyParticipation). */
  myParticipation: ReactNode;
  /** Priced Session: amount, bank accounts and the viewer's payment. */
  paymentSummary?: ReactNode;
  /** Anyone opens a player's sheet: profile, payment; organizers also
   *  Approve, Check in and Remove. */
  onOpenRowMenu: (p: SessionParticipant) => void;
  onAddParticipant: () => void;
};

// After who's playing, every other status gets its own grid, in this
// order, only when it has someone in it.
const OTHER_SECTIONS: { status: ParticipantStatus; label: string }[] = [
  { status: 'requested', label: 'sessionSectionRequested' },
  { status: 'waitlist', label: 'sessionSectionWaitlist' },
  { status: 'checked_out', label: 'sessionSectionCheckedOut' },
  { status: 'no_show', label: 'sessionSectionNoShow' },
  { status: 'cancelled', label: 'sessionSectionCancelled' },
];

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  checked_in: 'sessionSectionCheckedIn',
  registered: 'sessionSectionConfirmed',
  requested: 'sessionSectionRequested',
  waitlist: 'sessionSectionWaitlist',
  checked_out: 'sessionSectionCheckedOut',
  no_show: 'sessionSectionNoShow',
  cancelled: 'sessionSectionCancelled',
};

const GRID = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', rowGap: 16, columnGap: 12 } as const;

// Everyone — players and organizers alike — sees every participant, in
// every status, as a circle (DP-024). Tapping one opens their sheet,
// where an organizer finds the actions (Approve, Check in, payment,
// Remove).
export function PlayersTab({
  session,
  participants,
  myUserId,
  isOwnerOrAdmin,
  canAddParticipant,
  placeholderCount,
  myParticipation,
  paymentSummary,
  onOpenRowMenu,
  onAddParticipant,
}: Props) {
  const { t } = useTranslation();

  const playing = [
    ...participants.filter((p) => p.status === 'checked_in'),
    ...participants.filter((p) => p.status === 'registered'),
  ];

  // A player as a circle: the green check once they've checked in; under
  // the name, their payment on a priced Session (Paid / Awaiting — never
  // the host or a guest, DP-012 v0.29.0), else "Host" or "Guest". Someone
  // who cancelled or didn't show is faded.
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
        faded={p.status === 'cancelled' || p.status === 'no_show'}
        caption={caption}
        captionTone={status === 'paid' ? 'success' : status === 'awaiting' ? 'warning' : 'muted'}
        onPress={() => onOpenRowMenu(p)}
        accessibilityLabel={[name, t(PARTICIPANT_STATUS_LABEL[p.status]), caption].filter(Boolean).join(', ')}
      />
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

        {/* Who's playing: checked-in and confirmed players, in one grid
            with the open spots. */}
        {playing.length + placeholderCount > 0 && (
          <View style={GRID}>
            {playing.map(renderParticipantCircle)}
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

        {OTHER_SECTIONS.map(({ status, label }) => {
          const list = participants.filter((p) => p.status === status);
          if (list.length === 0) return null;
          return (
            <VStack key={status} className="gap-3">
              <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark">
                {t(label)} · {list.length}
              </Text>
              <View style={GRID}>{list.map(renderParticipantCircle)}</View>
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
