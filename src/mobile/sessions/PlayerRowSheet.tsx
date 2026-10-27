import { View } from 'react-native';
import { Sheet } from '../../design-system/feedback/Sheet';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import { ParticipantPayment } from './SessionPayment';
import type { Session, SessionParticipant } from '../../core/api/types';

type Props = {
  sessionId: string;
  session: Session;
  participant: SessionParticipant | null;
  isOwnerOrAdmin: boolean;
  canRemove: boolean;
  // Check in is offered for a confirmed player while the window is open.
  canCheckIn: boolean;
  myUserId?: string;
  busy: boolean;
  onClose: () => void;
  onConfirmPayment: (userId: string) => void;
  onRemove: (p: SessionParticipant) => void;
  onViewProfile: (p: SessionParticipant) => void;
  onCheckIn: (participantId: string) => void;
};

// An organizer opens a player in Players (DP-024): their profile (DP-019),
// Check in while the window is open, their payment on a priced Session
// (receipt, Confirm payment) and Remove.
export function PlayerRowSheet({
  sessionId,
  session,
  participant,
  isOwnerOrAdmin,
  canRemove,
  canCheckIn,
  myUserId,
  busy,
  onClose,
  onConfirmPayment,
  onRemove,
  onViewProfile,
  onCheckIn,
}: Props) {
  const { t } = useTranslation();
  const p = participant;
  return (
    <Sheet visible={p !== null} onClose={onClose} title={p ? p.displayName || p.username || p.guestName : undefined}>
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
          <ButtonText>{t('sessionRemoveParticipant')}</ButtonText>
        </Button>
      )}
    </Sheet>
  );
}
