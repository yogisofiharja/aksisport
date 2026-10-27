import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { CodeInput } from '../../design-system/ui/CodeInput';
import { Field } from '../../design-system/ui/Field';
import { Input, InputField } from '../../design-system/ui/Input';
import { PasswordInput } from '../../design-system/ui/PasswordInput';
import { Typography } from '../../design-system/ui/Typography';
import { AppBar } from '../../design-system/layout/AppBar';
import { useTranslation } from '../../i18n';
import { confirmPasswordReset, requestPasswordReset } from '../../core/api/client';
import { MIN_PASSWORD_LENGTH } from '../../core/auth/signUpValidation';
import { RESEND_COOLDOWN_SECONDS, useCountdown } from '../../core/useCountdown';

type Props = {
  onBackToLogin: () => void;
};

const CODE_LENGTH = 6;

// Forgot password (DP-015): username or email -> emailed code -> new
// password. The request step answers the same whether or not the account
// exists, so the copy after it is deliberately conditional ("if that
// account has a confirmed email…"). Same fields as Create account and
// Confirm your email: digit boxes for the code, errors under the field.
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

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canReset = code.length === CODE_LENGTH && password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword && !busy;

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
      <AppBar onBack={onBackToLogin} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-4 pt-4 pb-8 gap-5" keyboardShouldPersistTaps="handled">
          {step === 'request' && (
            <>
              <View className="gap-1">
                <Typography variant="heading" accessibilityRole="header" className="font-display-hero text-[34px] leading-[38px]">
                  {t('forgotPasswordTitle')}
                </Typography>
                <Typography variant="body" color="muted">
                  {t('forgotPasswordDesc')}
                </Typography>
              </View>
              <Field label={t('authUsernameOrEmail')} error={error}>
                <Input isInvalid={Boolean(error)}>
                  <InputField
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    value={identifier}
                    onChangeText={(v) => setIdentifier(v.toLowerCase())}
                    onSubmitEditing={request}
                  />
                </Input>
              </Field>
              <Button size="lg" loading={busy} isDisabled={busy || !identifier.trim()} className="w-full" onPress={request}>
                <ButtonText>{t('emailSendCode')}</ButtonText>
              </Button>
            </>
          )}

          {step === 'reset' && (
            <>
              <View className="gap-1">
                <Typography variant="heading" accessibilityRole="header" className="font-display-hero text-[34px] leading-[38px]">
                  {t('forgotPasswordResetTitle')}
                </Typography>
                <Typography variant="body" color="muted">
                  {t('forgotPasswordCodeSent')}
                </Typography>
              </View>
              <Field label={t('emailCodeLabel')} error={error}>
                <CodeInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setError(null);
                  }}
                  length={CODE_LENGTH}
                  isInvalid={Boolean(error)}
                  digitLabel={t('emailCodeDigit')}
                />
              </Field>
              <Field label={t('forgotPasswordNew')} error={tooShort ? t('authPasswordTooShort') : null}>
                <PasswordInput
                  value={password}
                  onChangeText={setPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  isInvalid={tooShort}
                  showLabel={t('authShowPassword')}
                  hideLabel={t('authHidePassword')}
                />
              </Field>
              <Field label={t('authConfirmPassword')} error={mismatch ? t('authPasswordMismatch') : null}>
                <PasswordInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onSubmitEditing={reset}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  isInvalid={mismatch}
                  showLabel={t('authShowPassword')}
                  hideLabel={t('authHidePassword')}
                />
              </Field>
              <View className="flex-row flex-wrap items-center gap-x-1">
                <Text className="text-sm font-sans text-ink-muted dark:text-ink-muted-dark">{t('emailNoCode')}</Text>
                {resendIn > 0 ? (
                  <Text className="text-sm font-sans-semibold text-ink-muted dark:text-ink-muted-dark">{t('emailResendIn', resendIn)}</Text>
                ) : (
                  <Pressable onPress={request} disabled={busy} accessibilityRole="button" className="active:opacity-60">
                    <Text className="text-sm font-sans-bold text-heat-strong dark:text-heat-strong-dark">{t('emailResendCode')}</Text>
                  </Pressable>
                )}
              </View>
              <Button size="lg" loading={busy} isDisabled={!canReset} className="w-full" onPress={reset}>
                <ButtonText>{t('forgotPasswordSubmit')}</ButtonText>
              </Button>
            </>
          )}

          {step === 'done' && (
            <>
              <View className="gap-1">
                <Typography variant="heading" accessibilityRole="header" className="font-display-hero text-[34px] leading-[38px]">
                  {t('forgotPasswordDoneTitle')}
                </Typography>
                <Typography variant="body" color="muted">
                  {t('forgotPasswordDoneDesc')}
                </Typography>
              </View>
              <Button size="lg" className="w-full" onPress={onBackToLogin}>
                <ButtonText>{t('authLogIn')}</ButtonText>
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
