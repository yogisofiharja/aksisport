import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button, ButtonText } from '../../../components/ui/button';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { listClubBankAccounts } from '../../core/clubs/api';
import { participantReceiptUrl, uploadPaymentReceipt } from '../../core/sessions/api';
import { formatIDR } from '../../core/currency';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import type { ClubBankAccount, Session, SessionParticipant } from '../../core/api/types';

// Payments (Milestone 5, DP-012) live in a Session's Players tab
// (DP-024): PaymentSummary at the top of the tab (amount due, the
// Community's bank accounts, the viewer's own payment and receipt), and
// ParticipantPayment in a player's row sheet, where organizers look at the
// receipt and confirm. Receipt visibility is unchanged: an image is only
// ever fetched by its uploader or an owner/admin (the server checks too).

export { hasPaid, isAwaitingPayment, paymentStatus } from '../../core/sessions/paymentStatus';
import { hasPaid, isAwaitingPayment, paymentStatus } from '../../core/sessions/paymentStatus';

// GET .../participants/:id/receipt is behind the same auth as every
// other route, plus a narrower server-side access check (self or
// owner/admin) — see sessions_handler.go.
function useImageHeaders() {
  const [headers, setHeaders] = useState<Record<string, string>>({});
  useEffect(() => {
    authHeader().then(setHeaders);
  }, []);
  return headers;
}

type SummaryProps = {
  sessionId: string;
  session: Session;
  myParticipant?: SessionParticipant;
  onParticipantsChanged: () => void;
};

// The top of Players on a priced Session.
export function PaymentSummary({ sessionId, session, myParticipant, onParticipantsChanged }: SummaryProps) {
  const { t } = useTranslation();
  const [bankAccounts, setBankAccounts] = useState<ClubBankAccount[]>([]);
  const imageHeaders = useImageHeaders();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBankAccounts = useCallback(async () => {
    try {
      setBankAccounts(await listClubBankAccounts(session.clubId));
    } catch {
      // stays empty; not fatal, the rest of the tab still renders
    }
  }, [session.clubId]);

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts]);

  const amountDue =
    session.priceModel === 'per_person'
      ? session.pricePerPerson
      : session.priceModel === 'split_bill' && session.totalPrice != null && session.joinedCount > 0
        ? Math.round(session.totalPrice / session.joinedCount)
        : undefined;

  async function handleUploadReceipt() {
    appAlert(t('sessionChatAttachImageTitle'), undefined, [
      { text: t('sessionChatAttachCamera'), onPress: () => pickAndUpload('camera') },
      { text: t('sessionChatAttachGallery'), onPress: () => pickAndUpload('gallery') },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  async function pickAndUpload(source: 'camera' | 'gallery') {
    const dataUrl = await pickImageAsDataUrl(source);
    if (!dataUrl) return;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPaymentReceipt(sessionId, parsed);
      onParticipantsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <VStack className="gap-5">
      {amountDue != null && (
        <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4">
          <HStack className="justify-between">
            <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionPaymentAmountDueLabel')}</Text>
            <Text className="font-bold text-ink dark:text-ink-dark">{formatIDR(amountDue)}</Text>
          </HStack>
        </Box>
      )}

      <VStack className="gap-2">
        <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t('clubBankAccountsTitle')}</Text>
        {bankAccounts.length === 0 ? (
          <Text className="text-ink-muted dark:text-ink-muted-dark text-sm">{t('sessionPaymentNoBankAccounts')}</Text>
        ) : (
          bankAccounts.map((account) => (
            <Box key={account.id} className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-0.5">
              <Text className="font-bold text-ink dark:text-ink-dark">{account.bankName}</Text>
              <Text className="text-ink-muted dark:text-ink-muted-dark">{account.accountNumber}</Text>
              <Text className="text-ink-muted dark:text-ink-muted-dark text-sm">{account.accountName}</Text>
            </Box>
          ))
        )}
      </VStack>

      {myParticipant && paymentStatus(myParticipant, session) && (
        <VStack className="gap-2">
          <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t('sessionPaymentYourPaymentTitle')}</Text>
          <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
            <Text className={hasPaid(myParticipant) ? 'text-success dark:text-success-dark font-bold' : 'text-heat-strong dark:text-heat-strong-dark font-bold'}>
              {hasPaid(myParticipant) ? t('sessionPaymentStatusPaid') : t('sessionPaymentStatusAwaiting')}
            </Text>
            {myParticipant.hasReceipt && (
              <Image
                source={{ uri: participantReceiptUrl(sessionId, myParticipant.id), headers: imageHeaders }}
                style={{ width: 120, height: 120, borderRadius: 12 }}
                resizeMode="cover"
              />
            )}
            <Button variant="outline" size="sm" className="self-start" isDisabled={uploading} onPress={handleUploadReceipt}>
              {uploading ? (
                <ActivityIndicator size="small" />
              ) : (
                <ButtonText variant="outline">{myParticipant.hasReceipt ? t('sessionPaymentReplaceReceipt') : t('sessionPaymentUploadReceipt')}</ButtonText>
              )}
            </Button>
            {error && <Text className="text-sm text-red-500">{error}</Text>}
          </Box>
        </VStack>
      )}
    </VStack>
  );
}

type ParticipantPaymentProps = {
  sessionId: string;
  session: Pick<Session, 'priceModel' | 'createdBy'>;
  participant: SessionParticipant;
  isOwnerOrAdmin: boolean;
  myUserId?: string;
  busy: boolean;
  onConfirmPayment: (userId: string) => void;
};

// One player's payment, in their row sheet on Players: Paid / Awaiting,
// the receipt (organizers, or the player themselves), and Confirm payment
// for organizers while it is awaited. Nothing for a player with no payment
// status (see paymentStatus).
export function ParticipantPayment({ sessionId, session, participant: p, isOwnerOrAdmin, myUserId, busy, onConfirmPayment }: ParticipantPaymentProps) {
  const { t } = useTranslation();
  const imageHeaders = useImageHeaders();
  if (!paymentStatus(p, session)) return null;
  const canSeeReceipt = (isOwnerOrAdmin || (p.userId != null && p.userId === myUserId)) && p.hasReceipt;
  return (
    <VStack className="gap-3">
      <Text className={`font-bold ${hasPaid(p) ? 'text-success dark:text-success-dark' : 'text-heat-strong dark:text-heat-strong-dark'}`}>
        {hasPaid(p) ? t('sessionPaymentStatusPaid') : t('sessionPaymentStatusAwaiting')}
      </Text>
      {canSeeReceipt && (
        <Image
          source={{ uri: participantReceiptUrl(sessionId, p.id), headers: imageHeaders }}
          style={{ width: 220, height: 220, borderRadius: 12 }}
          resizeMode="cover"
        />
      )}
      {isOwnerOrAdmin && isAwaitingPayment(p) && p.userId && (
        <Button size="lg" className="w-full" isDisabled={busy} onPress={() => onConfirmPayment(p.userId!)}>
          <ButtonText>{t('sessionPaymentConfirm')}</ButtonText>
        </Button>
      )}
    </VStack>
  );
}
