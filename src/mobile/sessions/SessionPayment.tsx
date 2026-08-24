import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image } from 'react-native';
import { Icon } from '../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button, ButtonText } from '../../../components/ui/button';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { listClubBankAccounts } from '../../core/clubs/api';
import { participantReceiptUrl, uploadPaymentReceipt } from '../../core/sessions/api';
import { formatIDR } from '../../core/currency';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import type { ClubBankAccount, Session, SessionParticipant } from '../../core/api/types';

type Props = {
  sessionId: string;
  session: Session;
  participants: SessionParticipant[];
  myParticipant?: SessionParticipant;
  isOwnerOrAdmin: boolean;
  onConfirmPayment: (userId: string) => void;
  onParticipantsChanged: () => void;
};

function participantName(p: SessionParticipant) {
  return p.displayName || p.username || p.guestName || '';
}

// Milestone 5 — waitlist (approved, payment not yet confirmed) reads as
// "awaiting"; registered/checked_in/checked_out all mean the slot is
// claimed, i.e. "paid" in this domain's terms. 'requested' participants
// haven't been approved yet at all, so they have no payment status —
// excluded entirely, not shown as either.
function isAwaitingPayment(p: SessionParticipant) {
  return p.status === 'waitlist';
}
function hasPaid(p: SessionParticipant) {
  return p.status === 'registered' || p.status === 'checked_in' || p.status === 'checked_out';
}

export function SessionPayment({
  sessionId,
  session,
  participants,
  myParticipant,
  isOwnerOrAdmin,
  onConfirmPayment,
  onParticipantsChanged,
}: Props) {
  const { t } = useTranslation();
  const [bankAccounts, setBankAccounts] = useState<ClubBankAccount[]>([]);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingReceiptOf, setViewingReceiptOf] = useState<string | null>(null);

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

  // GET .../participants/:id/receipt is behind the same auth as every
  // other route, plus a narrower server-side access check (self or
  // owner/admin) — see sessions_handler.go. Fetched once per mount, same
  // convention as SessionChat's own image headers.
  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const isFree = session.priceModel === 'free';
  const amountDue =
    session.priceModel === 'per_person'
      ? session.pricePerPerson
      : session.priceModel === 'split_bill' && session.totalPrice != null && session.joinedCount > 0
        ? Math.round(session.totalPrice / session.joinedCount)
        : undefined;

  async function handleUploadReceipt() {
    Alert.alert(t('sessionChatAttachImageTitle'), undefined, [
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

  const payable = participants.filter((p) => isAwaitingPayment(p) || hasPaid(p));

  return (
    <VStack className="gap-5">
      {isFree ? (
        <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4">
          <Text className="text-slate-500 dark:text-slate-400">{t('sessionPaymentFreeNotice')}</Text>
        </Box>
      ) : (
        <>
          {amountDue != null && (
            <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <HStack className="justify-between">
                <Text className="text-slate-500 dark:text-slate-400">{t('sessionPaymentAmountDueLabel')}</Text>
                <Text className="font-bold text-slate-900 dark:text-white">{formatIDR(amountDue)}</Text>
              </HStack>
            </Box>
          )}

          <VStack className="gap-2">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('clubBankAccountsTitle')}</Text>
            {bankAccounts.length === 0 ? (
              <Text className="text-slate-500 dark:text-slate-400 text-sm">{t('sessionPaymentNoBankAccounts')}</Text>
            ) : (
              bankAccounts.map((account) => (
                <Box key={account.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-0.5">
                  <Text className="font-bold text-slate-900 dark:text-white">{account.bankName}</Text>
                  <Text className="text-slate-500 dark:text-slate-400">{account.accountNumber}</Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-sm">{account.accountName}</Text>
                </Box>
              ))
            )}
          </VStack>

          {myParticipant && (isAwaitingPayment(myParticipant) || hasPaid(myParticipant)) && (
            <VStack className="gap-2">
              <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('sessionPaymentYourPaymentTitle')}</Text>
              <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-3">
                <Text className={hasPaid(myParticipant) ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                  {hasPaid(myParticipant) ? t('sessionPaymentStatusPaid') : t('sessionPaymentStatusAwaiting')}
                </Text>
                {myParticipant.hasReceipt && (
                  <Image
                    source={{ uri: participantReceiptUrl(sessionId, myParticipant.id), headers: imageHeaders }}
                    style={{ width: 120, height: 120, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                )}
                <Button action="secondary" variant="outline" size="sm" className="self-start" isDisabled={uploading} onPress={handleUploadReceipt}>
                  {uploading ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <ButtonText action="secondary" variant="outline">
                      {myParticipant.hasReceipt ? t('sessionPaymentReplaceReceipt') : t('sessionPaymentUploadReceipt')}
                    </ButtonText>
                  )}
                </Button>
                {error && <Text className="text-sm text-red-500">{error}</Text>}
              </Box>
            </VStack>
          )}
        </>
      )}

      {payable.length > 0 && (
        <VStack className="gap-2">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('sessionPaymentStatusTitle')}</Text>
          <VStack className="gap-2">
            {payable.map((p) => (
              <Box key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                <HStack className="justify-between items-center gap-3">
                  <Text className="font-bold text-slate-900 dark:text-white" style={{ flex: 1 }} numberOfLines={1}>
                    {participantName(p)}
                  </Text>
                  <Text className={`text-sm font-bold ${hasPaid(p) ? 'text-green-600' : 'text-amber-600'}`}>
                    {hasPaid(p) ? t('sessionPaymentStatusPaid') : t('sessionPaymentStatusAwaiting')}
                  </Text>
                  {(isOwnerOrAdmin || p.userId === myParticipant?.userId) && p.hasReceipt && (
                    <Pressable className="p-1.5 active:opacity-60" onPress={() => setViewingReceiptOf(p.id)}>
                      <Icon name="image-outline" size="sm" color="secondary" />
                    </Pressable>
                  )}
                  {isOwnerOrAdmin && isAwaitingPayment(p) && p.userId && (
                    <Pressable
                      className="px-3 py-1.5 rounded-full bg-blue-600 active:opacity-70"
                      onPress={() => onConfirmPayment(p.userId!)}
                    >
                      <Text className="text-white text-xs font-bold">{t('sessionPaymentConfirm')}</Text>
                    </Pressable>
                  )}
                </HStack>
                {viewingReceiptOf === p.id && p.hasReceipt && (
                  <Pressable className="mt-3 self-start" onPress={() => setViewingReceiptOf(null)}>
                    <Image
                      source={{ uri: participantReceiptUrl(sessionId, p.id), headers: imageHeaders }}
                      style={{ width: 220, height: 220, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  </Pressable>
                )}
              </Box>
            ))}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
}
