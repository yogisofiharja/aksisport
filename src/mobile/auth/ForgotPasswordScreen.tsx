import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../components/ui/button';
import { VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { confirmPasswordReset, requestPasswordReset } from '../../core/api/client';
import { PasswordField } from './PasswordField';
import { RESEND_COOLDOWN_SECONDS, useCountdown } from '../../core/useCountdown';

type Props = {
  onBackToLogin: () => void;
};

// Forgot password (DP-015): username or email -> emailed code -> new
// password. The request step answers the same whether or not the account
// exists, so the copy after it is deliberately conditional ("if that
// account has a confirmed email…").
export function ForgotPasswordScreen({ onBackToLogin }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The request step never says whether a code was really sent (or was
  // held back by the cooldown), so this counts from the last request made
  // here rather than from anything the server reports.
  const [resendIn, startResendCountdown] = useCountdown();

  async function request() {
    if (!identifier.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(identifier.trim());
      startResendCountdown(RESEND_COOLDOWN_SECONDS);
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  const canReset = code.length === 6 && password.length >= 6 && password === confirmPassword && !busy;

  async function reset() {
    if (!canReset) return;
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(identifier.trim(), code, password);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBackToLogin}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>

          {step === 'request' && (
            <>
              <VStack className="gap-2">
                <Heading size="2xl">{t('forgotPasswordTitle')}</Heading>
                <Text className="text-ink-muted dark:text-ink-muted-dark">{t('forgotPasswordDesc')}</Text>
              </VStack>
              <VStack className="gap-2">
                <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('authUsernameOrEmail')}</Text>
                <Input>
                  <InputField
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={identifier}
                    onChangeText={(v) => setIdentifier(v.toLowerCase())}
                    onSubmitEditing={request}
                  />
                </Input>
              </VStack>
              {error && <Text className="text-sm text-red-500">{error}</Text>}
              <Button
                size="xl"
                isDisabled={busy || !identifier.trim()}
                className="w-full"
                onPress={request}
              >
                <ButtonText>{t('emailSendCode')}</ButtonText>
              </Button>
            </>
          )}

          {step === 'reset' && (
            <>
              <VStack className="gap-2">
                <Heading size="2xl">{t('forgotPasswordResetTitle')}</Heading>
                <Text className="text-ink-muted dark:text-ink-muted-dark">{t('forgotPasswordCodeSent')}</Text>
              </VStack>
              <VStack className="gap-2">
                <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('emailCodeLabel')}</Text>
                <Input>
                  <InputField
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                  />
                </Input>
              </VStack>
              <VStack className="gap-2">
                <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('forgotPasswordNew')}</Text>
                <PasswordField value={password} onChangeText={setPassword} />
              </VStack>
              <VStack className="gap-2">
                <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('authConfirmPassword')}</Text>
                <PasswordField value={confirmPassword} onChangeText={setConfirmPassword} onSubmitEditing={reset} />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <Text className="text-xs text-red-500">{t('authPasswordMismatch')}</Text>
                )}
              </VStack>
              {error && <Text className="text-sm text-red-500">{error}</Text>}
              <Button
                size="xl"
                isDisabled={!canReset}
                className="w-full"
                onPress={reset}
              >
                <ButtonText>{t('forgotPasswordSubmit')}</ButtonText>
              </Button>
              {resendIn > 0 ? (
                <Text className="self-center font-bold text-ink-faint dark:text-ink-faint-dark">{t('emailResendIn', resendIn)}</Text>
              ) : (
                <Pressable className="self-center" onPress={request} disabled={busy}>
                  <Text className="font-bold text-heat-strong dark:text-heat-strong-dark">{t('emailResendCode')}</Text>
                </Pressable>
              )}
            </>
          )}

          {step === 'done' && (
            <>
              <VStack className="gap-2">
                <Heading size="2xl">{t('forgotPasswordDoneTitle')}</Heading>
                <Text className="text-ink-muted dark:text-ink-muted-dark">{t('forgotPasswordDoneDesc')}</Text>
              </VStack>
              <Button size="xl" className="w-full" onPress={onBackToLogin}>
                <ButtonText>{t('authLogIn')}</ButtonText>
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
