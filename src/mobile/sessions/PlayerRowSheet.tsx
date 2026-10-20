import { Sheet } from '../../design-system/feedback/Sheet';
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
  myUserId?: string;
  busy: boolean;
  onClose: () => void;
  onConfirmPayment: (userId: string) => void;
  onRemove: (p: SessionParticipant) => void;
};

// An organizer's ⋯ on a player's row in Players (DP-024): their payment
// on a priced Session (receipt, Confirm payment) and Remove.
export function PlayerRowSheet({
  sessionId,
  session,
  participant,
  isOwnerOrAdmin,
  canRemove,
  myUserId,
  busy,
  onClose,
  onConfirmPayment,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const p = participant;
  return (
    <Sheet visible={p !== null} onClose={onClose} title={p ? p.displayName || p.username || p.guestName : undefined}>
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
