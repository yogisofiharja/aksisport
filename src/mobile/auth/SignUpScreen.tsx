import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { USERNAME_PATTERN } from '../../core/auth/firebaseAuth';
import { checkUsername } from '../../core/api/client';

type Props = {
  onNavigateToLogin: () => void;
};

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function SignUpScreen({ onNavigateToLogin }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username) {
      setAvailability('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setAvailability('invalid');
      return;
    }
    setAvailability('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const { available } = await checkUsername(username);
        setAvailability(available ? 'available' : 'taken');
      } catch {
        setAvailability('idle');
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  const canSubmit =
    availability === 'available' &&
    password.length >= 6 &&
    password === confirmPassword &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signUp(username, password);
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
            <Heading size="2xl">{t('authSignUpTitle')}</Heading>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('authUsername')}</Text>
            <Input>
              <InputField
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('authUsernamePlaceholder')}
                value={username}
                onChangeText={(v) => setUsername(v.toLowerCase())}
                maxLength={20}
              />
            </Input>
            {availability === 'checking' && (
              <Text className="text-xs text-slate-400">{t('authUsernameChecking')}</Text>
            )}
            {availability === 'available' && (
              <Text className="text-xs text-teal-600 dark:text-teal-400">{t('authUsernameAvailable')}</Text>
            )}
            {availability === 'taken' && (
              <Text className="text-xs text-red-500">{t('authUsernameTaken')}</Text>
            )}
            {availability === 'invalid' && (
              <Text className="text-xs text-red-500">{t('authUsernameInvalid')}</Text>
            )}
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('authPassword')}</Text>
            <Input>
              <InputField secureTextEntry value={password} onChangeText={setPassword} />
            </Input>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('authConfirmPassword')}</Text>
            <Input>
              <InputField secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
            </Input>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text className="text-xs text-red-500">{t('authPasswordMismatch')}</Text>
            )}
          </VStack>

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button
            action="secondary"
            size="xl"
            isDisabled={!canSubmit}
            className="w-full rounded-2xl bg-blue-600"
            onPress={handleSubmit}
          >
            <ButtonText className="text-white text-xl">{t('authSignUp')}</ButtonText>
          </Button>

          <Box className="items-center pt-2">
            <Pressable onPress={onNavigateToLogin}>
              <Text className="text-slate-500 dark:text-slate-400">
                {t('authHaveAccount')} <Text className="font-bold text-blue-600 dark:text-blue-400">{t('authLogInLink')}</Text>
              </Text>
            </Pressable>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
