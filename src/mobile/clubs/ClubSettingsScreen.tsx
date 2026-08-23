import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import { createClubBankAccount, deleteClub, deleteClubBankAccount, listClubBankAccounts, updateClubBankAccount } from '../../core/clubs/api';
import { ApiRequestError } from '../../core/api/client';
import type { ClubBankAccount } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onDeleted: () => void;
};

// null = closed, 'new' = add form, an account = edit form pre-filled from it.
type ModalState = ClubBankAccount | 'new' | null;

// Owner-only screen (gated at the entry point — ClubDetailScreen's gear
// icon only shows for isOwner; the backend independently enforces owner-
// only on every mutation here too). Holds every Club-level setting that
// isn't just "edit name/description" — currently Bank Accounts (DP-012)
// and the Danger Zone. Deleting a Community deliberately lives here, not
// as an easy-to-tap link on ClubDetailScreen's own home page.
export function ClubSettingsScreen({ clubId, onBack, onDeleted }: Props) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<ClubBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccounts(await listClubBankAccounts(clubId));
    } catch {
      // keep stale list; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openAdd() {
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setError(null);
    setModal('new');
  }

  function openEdit(account: ClubBankAccount) {
    setBankName(account.bankName);
    setAccountNumber(account.accountNumber);
    setAccountName(account.accountName);
    setError(null);
    setModal(account);
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
  }

  async function handleSave() {
    const trimmedBank = bankName.trim();
    const trimmedNumber = accountNumber.trim();
    const trimmedName = accountName.trim();
    if (!trimmedBank || !trimmedNumber || !trimmedName) {
      setError(t('clubBankAccountFieldsRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (modal === 'new') {
        await createClubBankAccount(clubId, { bankName: trimmedBank, accountNumber: trimmedNumber, accountName: trimmedName });
      } else if (modal) {
        await updateClubBankAccount(clubId, modal.id, { bankName: trimmedBank, accountNumber: trimmedNumber, accountName: trimmedName });
      }
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('authGenericError'));
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteAccount(account: ClubBankAccount) {
    Alert.alert(t('clubBankAccountDeleteConfirmTitle'), t('clubBankAccountDeleteConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClubBankAccount(clubId, account.id);
            await load();
          } catch {
            // list stays as-is; user can retry the delete
          }
        },
      },
    ]);
  }

  function handleDeleteClub() {
    Alert.alert(t('clubDeleteConfirmTitle'), t('clubDeleteConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubConfirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteClub(clubId);
            onDeleted();
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <VStack className="px-5 pt-4 pb-2 gap-3">
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <Heading size="2xl">{t('clubSettingsTitle')}</Heading>
      </VStack>

      {loading ? (
        <Loading fullScreen />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 12 }}>
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('clubBankAccountsTitle')}</Text>

          {accounts.length === 0 ? (
            <Text className="text-slate-500 dark:text-slate-400">{t('clubBankAccountsEmpty')}</Text>
          ) : (
            accounts.map((account) => (
              <Box key={account.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-1">
                <HStack className="justify-between items-start">
                  <VStack className="gap-0.5" style={{ flex: 1 }}>
                    <Text className="font-bold text-slate-900 dark:text-white">{account.bankName}</Text>
                    <Text className="text-slate-500 dark:text-slate-400">{account.accountNumber}</Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-sm">{account.accountName}</Text>
                  </VStack>
                  <HStack className="gap-1">
                    <Pressable className="p-2 active:opacity-60" onPress={() => openEdit(account)}>
                      <Icon name="pencil-outline" size="sm" color="muted" />
                    </Pressable>
                    <Pressable className="p-2 active:opacity-60" onPress={() => handleDeleteAccount(account)}>
                      <Icon name="trash-outline" size="sm" color="destructive" />
                    </Pressable>
                  </HStack>
                </HStack>
              </Box>
            ))
          )}

          <Button action="secondary" variant="outline" size="lg" className="w-full rounded-2xl mt-1" onPress={openAdd}>
            <ButtonText action="secondary" variant="outline">
              {t('clubBankAccountAdd')}
            </ButtonText>
          </Button>

          <Box className="h-px bg-slate-200 dark:bg-slate-700 my-3" />

          <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('clubDangerZoneTitle')}</Text>
          <Button action="negative" variant="outline" size="lg" className="w-full rounded-2xl" isDisabled={deleting} onPress={handleDeleteClub}>
            <ButtonText action="negative" variant="outline">
              {t('clubDeleteClub')}
            </ButtonText>
          </Button>
        </ScrollView>
      )}

      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={closeModal}>
            <Pressable className="bg-white dark:bg-slate-800 rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
              <Box className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-1" />
              <Text className="text-lg font-black text-slate-900 dark:text-white text-center mb-1">
                {modal === 'new' ? t('clubBankAccountAdd') : t('clubBankAccountEdit')}
              </Text>

              <VStack className="gap-3">
                <VStack className="gap-1">
                  <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('clubBankAccountBankNameLabel')}</Text>
                  <Input>
                    <InputField value={bankName} onChangeText={setBankName} maxLength={80} autoFocus />
                  </Input>
                </VStack>
                <VStack className="gap-1">
                  <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('clubBankAccountNumberLabel')}</Text>
                  <Input>
                    <InputField value={accountNumber} onChangeText={setAccountNumber} maxLength={40} keyboardType="number-pad" />
                  </Input>
                </VStack>
                <VStack className="gap-1">
                  <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('clubBankAccountNameLabel')}</Text>
                  <Input>
                    <InputField value={accountName} onChangeText={setAccountName} maxLength={80} />
                  </Input>
                </VStack>
              </VStack>

              {error && <Text className="text-sm text-red-500">{error}</Text>}

              <Button action="secondary" size="lg" className="w-full rounded-2xl" isDisabled={saving} onPress={handleSave}>
                <ButtonText className="text-white">{t('clubBankAccountSave')}</ButtonText>
              </Button>
              <Pressable className="items-center py-1 active:opacity-60" onPress={closeModal} disabled={saving}>
                <Text className="text-slate-400 font-bold">{t('clubCancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
