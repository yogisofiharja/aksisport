import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Image } from '../../platform/Image';
import { appAlert } from '../../design-system/feedback/appAlert';
import { Alert } from '../../design-system/feedback/Alert';
import { ImageViewer } from '../../design-system/feedback/ImageViewer';
import { Icon } from '../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { Button, ButtonText } from '../../../components/ui/button';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { participantReceiptUrl, uploadPaymentReceipt } from '../../core/sessions/api';
import { formatIDR } from '../../core/currency';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import type { ClubBankAccount, Session, SessionParticipant } from '../../core/api/types';

// Payments (Milestone 5, DP-012) live in a Session's Players tab
// (DP-024): PaymentSummary at the top of the tab (the viewer's own
// payment, what to pay and where), and ParticipantPayment in a player's
// row sheet, where organizers look at the receipt and confirm. Receipt
// visibility is unchanged: an image is only ever fetched by its uploader
// or an owner/admin (the server checks too).

export { hasPaid, isAwaitingPayment, paymentStatus, receiptToCheck } from '../../core/sessions/paymentStatus';
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

export type ReceiptUpload = {
  uploading: boolean;
  error: string | null;
  /** Asks camera or gallery, then uploads the picture as the receipt. */
  start: () => void;
};

// Uploading the viewer's own receipt. The Session screen owns it, so its
// bottom action ("Upload receipt") and the Players tab share one upload.
export function useReceiptUpload(sessionId: string, onUploaded: () => void): ReceiptUpload {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUpload(source: 'camera' | 'gallery') {
    const dataUrl = await pickImageAsDataUrl(source);
    if (!dataUrl) return;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPaymentReceipt(sessionId, parsed);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setUploading(false);
    }
  }

  return {
    uploading,
    error,
    start: () =>
      appAlert(t('sessionChatAttachImageTitle'), undefined, [
        { text: t('sessionChatAttachCamera'), onPress: () => pickAndUpload('camera') },
        { text: t('sessionChatAttachGallery'), onPress: () => pickAndUpload('gallery') },
        { text: t('clubCancel'), style: 'cancel' },
      ]),
  };
}

// What one person pays: the per-person price, or the split bill divided
// by who has joined.
export function amountDue(session: Session): number | undefined {
  if (session.priceModel === 'per_person') return session.pricePerPerson ?? undefined;
  if (session.priceModel === 'split_bill' && session.totalPrice != null && session.joinedCount > 0) {
    return Math.round(session.totalPrice / session.joinedCount);
  }
  return undefined;
}

// A receipt thumbnail that opens the whole picture — a transfer
// screenshot is only readable at full size.
function ReceiptThumbnail({ uri, headers, size }: { uri: string; headers: Record<string, string>; size: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} className="self-start active:opacity-70" accessibilityRole="imagebutton" accessibilityLabel={t('sessionPaymentViewReceipt')}>
        <Image source={{ uri, headers }} style={{ width: size, height: size, borderRadius: 12 }} resizeMode="cover" />
        <HStack className="items-center gap-1 mt-1.5">
          <Icon name="expand-outline" size="xs" color="muted" />
          <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark">{t('sessionPaymentViewReceipt')}</Text>
        </HStack>
      </Pressable>
      <ImageViewer uri={open ? uri : null} headers={headers} onClose={() => setOpen(false)} />
    </>
  );
}

function BankAccountCard({ account }: { account: ClubBankAccount }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  async function copy() {
    try {
      await Clipboard.setStringAsync(account.accountNumber.replace(/\s+/g, ''));
      setCopied(true);
    } catch {
      // Copying isn't available; the number is still on screen.
    }
  }
  return (
    <HStack className="bg-surface dark:bg-surface-dark rounded-2xl p-4 items-center gap-3">
      <VStack className="flex-1 gap-0.5">
        <Text className="font-bold text-ink dark:text-ink-dark">{account.bankName}</Text>
        <Text selectable className="text-ink dark:text-ink-dark tracking-wide">
          {account.accountNumber}
        </Text>
        <Text className="text-ink-muted dark:text-ink-muted-dark text-sm">{account.accountName}</Text>
      </VStack>
      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={t('sessionPaymentCopyAccountNumber')}
        className="flex-row items-center gap-1 px-3 py-2 rounded-full border border-border dark:border-border-dark active:opacity-60"
      >
        <Icon name={copied ? 'checkmark' : 'copy-outline'} size="xs" color={copied ? 'success' : 'default'} />
        <Text className="text-sm font-bold text-ink dark:text-ink-dark">{copied ? t('commonCopied') : t('commonCopy')}</Text>
      </Pressable>
    </HStack>
  );
}

type SummaryProps = {
  sessionId: string;
  session: Session;
  myParticipant?: SessionParticipant;
  isOwnerOrAdmin: boolean;
  bankAccounts: ClubBankAccount[];
  /** Set for the Community owner, who manages bank accounts. */
  onAddBankAccount?: () => void;
  receipt: ReceiptUpload;
};

// The top of Players on a priced Session. Each viewer sees what is theirs:
// - a player who still has to pay: the amount, where to send it, and
//   their receipt — the bottom action uploads it;
// - a player who has paid: just that, with their receipt;
// - organizers: no amount due, and a nudge when there is no account.
// The bank accounts are shown to everyone, always (DP-012).
export function PaymentSummary({ sessionId, session, myParticipant, isOwnerOrAdmin, bankAccounts, onAddBankAccount, receipt }: SummaryProps) {
  const { t } = useTranslation();
  const imageHeaders = useImageHeaders();
  const myStatus = myParticipant ? paymentStatus(myParticipant, session) : undefined;
  const due = amountDue(session);

  return (
    <VStack className="gap-5">
      {myParticipant && myStatus && (
        <VStack className="gap-2">
          <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t('sessionPaymentYourPaymentTitle')}</Text>
          <Box className="bg-surface dark:bg-surface-dark rounded-2xl p-4 gap-3">
            <HStack className="justify-between items-center">
              <Text
                className={
                  myStatus === 'paid' ? 'text-success dark:text-success-dark font-bold' : 'text-heat-strong dark:text-heat-strong-dark font-bold'
                }
              >
                {myStatus === 'paid'
                  ? t('sessionPaymentStatusPaid')
                  : myParticipant.hasReceipt
                    ? t('sessionPaymentStatusReceiptSent')
                    : t('sessionPaymentStatusAwaiting')}
              </Text>
              {myStatus === 'awaiting' && due != null && <Text className="font-bold text-ink dark:text-ink-dark">{formatIDR(due)}</Text>}
            </HStack>
            <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">
              {myStatus === 'paid'
                ? t('sessionPaymentPaidHint')
                : myParticipant.hasReceipt
                  ? t('sessionPaymentReceiptSentHint')
                  : t('sessionPaymentNotPaidHint')}
            </Text>
            {myParticipant.hasReceipt && (
              <ReceiptThumbnail
                uri={participantReceiptUrl(sessionId, myParticipant.id, myParticipant.receiptVersion)}
                headers={imageHeaders}
                size={120}
              />
            )}
            {/* Uploading the first receipt is the bottom action; here only
                a receipt already sent can be replaced, until it's confirmed. */}
            {isAwaitingPayment(myParticipant) && myParticipant.hasReceipt && (
              <Button variant="outline" size="sm" className="self-start" isDisabled={receipt.uploading} onPress={receipt.start}>
                {receipt.uploading ? <ActivityIndicator size="small" /> : <ButtonText variant="outline">{t('sessionPaymentReplaceReceipt')}</ButtonText>}
              </Button>
            )}
            {receipt.uploading && !myParticipant.hasReceipt && <ActivityIndicator size="small" className="self-start" />}
            {receipt.error && <Text className="text-sm text-red-500">{receipt.error}</Text>}
          </Box>
        </VStack>
      )}

      {/* The bank accounts are always shown (DP-012). */}
      <VStack className="gap-2">
        <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t('clubBankAccountsTitle')}</Text>
        {bankAccounts.length === 0 ? (
          isOwnerOrAdmin ? (
            <Alert
              tone="heat"
              icon="card-outline"
              title={t('sessionPaymentNoBankAccountsOrganizer')}
              actionLabel={onAddBankAccount ? t('clubBankAccountAdd') : undefined}
              onAction={onAddBankAccount}
            >
              {onAddBankAccount ? undefined : t('sessionPaymentNoBankAccountsAdminHint')}
            </Alert>
          ) : (
            <Text className="text-ink-muted dark:text-ink-muted-dark text-sm">{t('sessionPaymentNoBankAccounts')}</Text>
          )
        ) : (
          bankAccounts.map((account) => <BankAccountCard key={account.id} account={account} />)
        )}
      </VStack>
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

// One player's payment, in their row sheet on Players: Paid / Receipt
// sent / Not paid, the receipt (organizers, or the player themselves) at
// full size on a tap, and Confirm payment for organizers while it is
// awaited. Nothing for a player with no payment status (see paymentStatus).
export function ParticipantPayment({ sessionId, session, participant: p, isOwnerOrAdmin, myUserId, busy, onConfirmPayment }: ParticipantPaymentProps) {
  const { t } = useTranslation();
  const imageHeaders = useImageHeaders();
  if (!paymentStatus(p, session)) return null;
  const canSeeReceipt = (isOwnerOrAdmin || (p.userId != null && p.userId === myUserId)) && p.hasReceipt;
  return (
    <VStack className="gap-3 mb-4">
      <Text className={`font-bold ${hasPaid(p) ? 'text-success dark:text-success-dark' : 'text-heat-strong dark:text-heat-strong-dark'}`}>
        {hasPaid(p) ? t('sessionPaymentStatusPaid') : p.hasReceipt ? t('sessionPaymentStatusReceiptSent') : t('sessionPaymentStatusAwaiting')}
      </Text>
      {canSeeReceipt && <ReceiptThumbnail uri={participantReceiptUrl(sessionId, p.id, p.receiptVersion)} headers={imageHeaders} size={220} />}
      {isOwnerOrAdmin && isAwaitingPayment(p) && !p.hasReceipt && (
        <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('sessionPaymentNoReceiptYet')}</Text>
      )}
      {isOwnerOrAdmin && isAwaitingPayment(p) && p.userId && (
        <Button size="lg" className="w-full" isDisabled={busy} onPress={() => onConfirmPayment(p.userId!)}>
          <ButtonText>{t('sessionPaymentConfirm')}</ButtonText>
        </Button>
      )}
    </VStack>
  );
}
