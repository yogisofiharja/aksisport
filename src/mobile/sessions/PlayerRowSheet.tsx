import { View } from 'react-native';
import { Sheet } from '../../design-system/feedback/Sheet';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import { ParticipantPayment } from './SessionPayment';
import { PARTICIPANT_STATUS_LABEL } from './tabs/PlayersTab';
import type { Session, SessionParticipant } from '../../core/api/types';

type Props = {
  sessionId: string;
  session: Session;
  participant: SessionParticipant | null;
  isOwnerOrAdmin: boolean;
  canRemove: boolean;
  // Check in is offered for a confirmed player while the window is open.
  canCheckIn: boolean;
  // Approve / Decline are offered for a request while the Session is active.
  canApprove: boolean;
  myUserId?: string;
  busy: boolean;
  onClose: () => void;
  onConfirmPayment: (userId: string) => void;
  onRemove: (p: SessionParticipant) => void;
  onViewProfile: (p: SessionParticipant) => void;
  onCheckIn: (participantId: string) => void;
  onApprove: (userId: string) => void;
};

// A player opened from Players (DP-024) — by anyone, for any player,
// the host too: who they are (status, host, guest), their profile
// (DP-019) and their payment on a priced Session. Organizers also get
// Approve or Decline a request, Check in while the window is open, the
// receipt, Confirm payment and Remove.
export function PlayerRowSheet({
  sessionId,
  session,
  participant,
  isOwnerOrAdmin,
  canRemove,
  canCheckIn,
  canApprove,
  myUserId,
  busy,
  onClose,
  onConfirmPayment,
  onRemove,
  onViewProfile,
  onCheckIn,
  onApprove,
}: Props) {
  const { t, lang } = useTranslation();
  const p = participant;
  // "Checked in · host": what follows the status is lowercase.
  const description = p
    ? [
        t(PARTICIPANT_STATUS_LABEL[p.status]),
        ...[p.userId && p.userId === session.createdBy ? t('sessionHostLabel') : undefined, p.userId ? undefined : t('sessionAddParticipantGuestOption')]
          .filter(Boolean)
          .map((part) => part!.toLocaleLowerCase(lang)),
      ].join(' · ')
    : undefined;
  return (
    <Sheet visible={p !== null} onClose={onClose} title={p ? p.displayName || p.username || p.guestName : undefined} description={description}>
      {p && (p.userId || (canCheckIn && p.status === 'registered')) ? (
        <View className="mb-4">
          <ListGroup>
            {p.userId ? (
              <ListRow
                icon="person-outline"
                title={t('membersViewProfile')}
                chevron
                onPress={() => {
                  onClose();
                  onViewProfile(p);
                }}
              />
            ) : null}
            {canCheckIn && p.status === 'registered' ? (
              <ListRow
                icon="checkmark-circle-outline"
                title={t('sessionCheckIn')}
                onPress={() => {
                  onClose();
                  onCheckIn(p.id);
                }}
              />
            ) : null}
          </ListGroup>
        </View>
      ) : null}
      {p && canApprove && p.status === 'requested' && p.userId ? (
        <Button
          size="lg"
          className="w-full mb-3"
          isDisabled={busy}
          onPress={() => {
            onClose();
            onApprove(p.userId!);
          }}
        >
          <ButtonText>{t('clubJoinRequestApprove')}</ButtonText>
        </Button>
      ) : null}
      {p && session.priceModel !== 'free' && (
        <ParticipantPayment
          sessionId={sessionId}
          session={session}
          participant={p}
          isOwnerOrAdmin={isOwnerOrAdmin}
          myUserId={myUserId}
          busy={busy}
          onConfirmPayment={(userId) => {
            onClose();
            onConfirmPayment(userId);
          }}
        />
      )}
      {p && canRemove && (
        <Button
          variant="outline"
          action="negative"
          size="lg"
          className="w-full"
          onPress={() => {
            onClose();
            onRemove(p);
          }}
        >
          <ButtonText>{t(p.status === 'requested' ? 'clubJoinRequestDecline' : 'sessionRemoveParticipant')}</ButtonText>
        </Button>
      )}
    </Sheet>
  );
}
