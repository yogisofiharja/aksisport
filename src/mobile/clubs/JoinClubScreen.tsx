import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { joinClub } from '../../core/clubs/api';
import type { Club } from '../../core/api/types';

type Props = {
  onBack: () => void;
  onJoined: (club: Club) => void;
};

export function JoinClubScreen({ onBack, onJoined }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (code.length !== 5 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const club = await joinClub(code);
      onJoined(club);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>

          <VStack className="gap-1">
            <Text className="text-sm font-extrabold text-slate-400 dark:text-slate-500 tracking-widest uppercase">{t('clubJoinTitle')}</Text>
            <Text className="text-base text-slate-500 dark:text-slate-400">{t('clubJoinDesc')}</Text>
          </VStack>

          <Input>
            <InputField
              autoFocus
              autoCapitalize="characters"
              maxLength={5}
              placeholder={t('clubJoinCodePlaceholder')}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              onSubmitEditing={handleSubmit}
              className="text-3xl font-black tracking-[8px] text-center py-5"
            />
          </Input>

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button
            action="secondary"
            size="xl"
            isDisabled={code.length !== 5 || submitting}
            className="w-full rounded-2xl bg-blue-600"
            onPress={handleSubmit}
          >
            <ButtonText className="text-white text-xl">{t('clubJoinSubmit')}</ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
