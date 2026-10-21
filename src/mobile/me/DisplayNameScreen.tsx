import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../components/ui/button';
import { VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { updateMe } from '../../core/api/client';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  onBack: () => void;
};

const MAX_LENGTH = 40;

// Set, change or remove the caller's own display name (DP-016). Saving it
// empty removes it, and the User is shown by username again.
export function DisplayNameScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed === (profile?.displayName ?? '');

  async function save() {
    if (busy || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      await updateMe({ displayName: trimmed });
      await refreshProfile();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar variant="form" title={t('displayNameTitle')} onClose={onBack} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <Text className="text-ink-muted dark:text-ink-muted-dark">{t('displayNameDesc', profile?.username ?? '')}</Text>
          <VStack className="gap-2">
            <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('displayNameLabel')}</Text>
            <Input>
              <InputField
                autoCorrect={false}
                maxLength={MAX_LENGTH}
                placeholder={profile?.username}
                value={name}
                onChangeText={setName}
                onSubmitEditing={save}
              />
            </Input>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">
              {trimmed ? t('displayNameCount', trimmed.length, MAX_LENGTH) : t('displayNameEmptyHint')}
            </Text>
          </VStack>
          {error && <Text className="text-sm text-red-500">{error}</Text>}
          <Button
            size="xl"
            isDisabled={busy || unchanged}
            className="w-full"
            onPress={save}
          >
            <ButtonText>{t('sessionEditSubmit')}</ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
