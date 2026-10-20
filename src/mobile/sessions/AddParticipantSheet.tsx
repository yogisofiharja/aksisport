import { KeyboardAvoidingView, Modal, Platform, ScrollView } from 'react-native';
import { CloseOnBack } from '../../design-system/feedback/useBackToClose';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button, ButtonText } from '../../../components/ui/button';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { initialsFromName } from '../../core/initials';
import type { ClubMember } from '../../core/api/types';

export type AddParticipantStep = 'closed' | 'choose' | 'member' | 'guest';

type Props = {
  step: AddParticipantStep;
  onStep: (step: AddParticipantStep) => void;
  onClose: () => void;
  addableMembers: ClubMember[];
  busy: boolean;
  error: string | null;
  guestName: string;
  onGuestName: (name: string) => void;
  onPickMember: (userId: string) => void;
  onSubmitGuest: () => void;
};

// Milestone 2: tapping an empty participant-slot placeholder opens this
// chooser (Member vs Guest) — adding a club member to the roster, or a
// guest by name — and closes itself on success.
export function AddParticipantSheet({
  step,
  onStep,
  onClose,
  addableMembers,
  busy,
  error,
  guestName,
  onGuestName,
  onPickMember,
  onSubmitGuest,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={step !== 'closed'} transparent animationType="slide" onRequestClose={onClose}>
      <CloseOnBack onClose={onClose} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={onClose}>
          <Pressable className="bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
            <Box className="w-10 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center mb-1" />

            {step === 'choose' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">{t('sessionAddParticipantTitle')}</Text>
                <Button size="lg" className="w-full" onPress={() => onStep('member')}>
                  <ButtonText>{t('sessionAddParticipantMemberOption')}</ButtonText>
                </Button>
                <Button variant="outline" size="lg" className="w-full" onPress={() => onStep('guest')}>
                  <ButtonText variant="outline">{t('sessionAddParticipantGuestOption')}</ButtonText>
                </Button>
                <Pressable className="items-center py-1 active:opacity-60" onPress={onClose}>
                  <Text className="text-ink-muted dark:text-ink-muted-dark font-bold">{t('clubCancel')}</Text>
                </Pressable>
              </VStack>
            )}

            {step === 'member' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">{t('sessionAddMemberLabel')}</Text>
                {addableMembers.length === 0 ? (
                  <Text className="text-ink-muted dark:text-ink-muted-dark text-center py-4">{t('sessionAddParticipantNoMembers')}</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 320 }}>
                    <HStack className="flex-wrap items-start" style={{ rowGap: 16, columnGap: 12 }}>
                      {addableMembers.map((m) => (
                        <Pressable
                          key={m.userId}
                          onPress={() => onPickMember(m.userId)}
                          disabled={busy}
                          className="items-center active:opacity-60"
                          style={{ width: 76 }}
                        >
                          <Box className="w-16 h-16 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-border-strong dark:border-border-strong-dark">
                            <Text className="text-base font-extrabold text-ink-muted dark:text-ink-muted-dark">
                              {initialsFromName(m.displayName || m.username)}
                            </Text>
                          </Box>
                          <Text className="text-xs font-bold text-ink dark:text-ink-dark text-center mt-1" numberOfLines={2}>
                            {m.displayName || m.username}
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </ScrollView>
                )}
                {error && <Text className="text-sm text-red-500">{error}</Text>}
                <Pressable className="items-center py-1 active:opacity-60" onPress={() => onStep('choose')}>
                  <Text className="text-heat-strong dark:text-heat-strong-dark font-bold">{t('back')}</Text>
                </Pressable>
              </VStack>
            )}

            {step === 'guest' && (
              <VStack className="gap-3">
                <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">{t('sessionAddGuest')}</Text>
                <Input>
                  <InputField
                    placeholder={t('sessionAddGuestPlaceholder')}
                    value={guestName}
                    onChangeText={onGuestName}
                    onSubmitEditing={onSubmitGuest}
                    autoFocus
                  />
                </Input>
                {error && <Text className="text-sm text-red-500">{error}</Text>}
                <Button size="lg" className="w-full" isDisabled={busy || !guestName.trim()} onPress={onSubmitGuest}>
                  <ButtonText>{t('sessionAdd')}</ButtonText>
                </Button>
                <Pressable className="items-center py-1 active:opacity-60" onPress={() => onStep('choose')}>
                  <Text className="text-heat-strong dark:text-heat-strong-dark font-bold">{t('back')}</Text>
                </Pressable>
              </VStack>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
