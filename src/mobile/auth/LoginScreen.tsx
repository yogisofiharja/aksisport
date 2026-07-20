import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';

type Props = {
  onNavigateToSignUp: () => void;
};

export function LoginScreen({ onNavigateToSignUp }: Props) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = username.length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-8 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <VStack className="gap-1">
            <Heading size="2xl">{t('authLoginTitle')}</Heading>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('authUsername')}</Text>
            <Input>
              <InputField
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={(v) => setUsername(v.toLowerCase())}
              />
            </Input>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('authPassword')}</Text>
            <Input>
              <InputField
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleSubmit}
              />
            </Input>
          </VStack>

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button
            action="secondary"
            size="xl"
            isDisabled={!canSubmit}
            className="w-full rounded-2xl bg-blue-600"
            onPress={handleSubmit}
          >
            <ButtonText className="text-white text-xl">{t('authLogIn')}</ButtonText>
          </Button>

          <Box className="items-center pt-2">
            <Pressable onPress={onNavigateToSignUp}>
              <Text className="text-slate-500 dark:text-slate-400">
                {t('authNoAccount')} <Text className="font-bold text-blue-600 dark:text-blue-400">{t('authCreateAccount')}</Text>
              </Text>
            </Pressable>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
