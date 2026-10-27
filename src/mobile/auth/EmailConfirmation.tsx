import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { CodeInput } from '../../design-system/ui/CodeInput';
import { Field } from '../../design-system/ui/Field';
import { Input, InputField } from '../../design-system/ui/Input';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { ApiRequestError, confirmEmailCode, requestEmailCode } from '../../core/api/client';
import { RESEND_COOLDOWN_SECONDS, useCountdown } from '../../core/useCountdown';

type Props = {
  // Called once the code is accepted and the profile has been refreshed.
  onConfirmed?: () => void;
  // Opens on the code step for this address instead of the pending one.
  initialEmail?: string;
};

const CODE_LENGTH = 6;

// The two-step email confirmation (DP-015): give an address, then enter
// the 6-digit code sent to it. Shared by the sign-up gate
// (VerifyEmailScreen) and the Me tab's add/change email screen
// (AccountEmailScreen). Opens on the code step when a code is already
// outstanding (profile.pendingEmail), which is the normal case right
// after sign-up.
//
// The code is six digit boxes (auto-advance, paste fills all six, one-
// time-code autofill); the last digit submits it. Errors show under the
// field they belong to.
export function EmailConfirmation({ onConfirmed, initialEmail }: Props) {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const pending = initialEmail ?? profile?.pendingEmail;
  const [step, setStep] = useState<'email' | 'code'>(pending ? 'code' : 'email');
  const [email, setEmail] = useState(pending ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Seconds until another code may be requested. Started by a successful
  // send, or by the server saying exactly how long is left.
  const [resendIn, startResendCountdown] = useCountdown();

  async function sendCode(resend: boolean) {
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestEmailCode(address);
      await refreshProfile();
      setCode('');
      setStep('code');
      startResendCountdown(RESEND_COOLDOWN_SECONDS);
      if (resend) setNotice(t('emailCodeResent'));
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'TOO_SOON' && err.retryAfterSeconds) {
        // The countdown on the resend link says it; no separate error.
        // A code is already out, so this belongs on the code step.
        startResendCountdown(err.retryAfterSeconds);
        setStep('code');
        return;
      }
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(value = code) {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await confirmEmailCode(value);
      await refreshProfile();
      onConfirmed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'email') {
    return (
      <View className="gap-4">
        <Field label={t('authEmail')} error={error}>
          <Input isInvalid={Boolean(error)}>
            <InputField
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              placeholder={t('authEmailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => sendCode(false)}
            />
          </Input>
        </Field>
        <Button size="lg" loading={busy} isDisabled={busy || !email.trim()} className="w-full" onPress={() => sendCode(false)}>
          <ButtonText>{t('emailSendCode')}</ButtonText>
        </Button>
      </View>
    );
  }

  const [before, after] = t('emailCodeSentTo', '\u0000').split('\u0000');

  return (
    <View className="gap-5">
      <Typography variant="body" color="muted">
        {before}
        <Text className="font-sans-bold text-ink dark:text-ink-dark">{email.trim()}</Text>
        {after}
      </Typography>

      <Field label={t('emailCodeLabel')} error={error} hint={notice ?? undefined}>
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
          onComplete={confirm}
          length={CODE_LENGTH}
          isInvalid={Boolean(error)}
          digitLabel={t('emailCodeDigit')}
          autoFocus
        />
      </Field>

      <View className="flex-row flex-wrap items-center gap-x-1">
        <Text className="text-sm font-sans text-ink-muted dark:text-ink-muted-dark">{t('emailNoCode')}</Text>
        {resendIn > 0 ? (
          <Text className="text-sm font-sans-semibold text-ink-muted dark:text-ink-muted-dark">{t('emailResendIn', resendIn)}</Text>
        ) : (
          <Pressable onPress={() => sendCode(true)} disabled={busy} accessibilityRole="button" className="active:opacity-60">
            <Text className="text-sm font-sans-bold text-heat-strong dark:text-heat-strong-dark">{t('emailResendCode')}</Text>
          </Pressable>
        )}
      </View>

      <Button size="lg" loading={busy} isDisabled={busy || code.length !== CODE_LENGTH} className="w-full" onPress={() => confirm()}>
        <ButtonText>{t('emailConfirm')}</ButtonText>
      </Button>

      <Pressable
        className="self-center py-1 active:opacity-60"
        onPress={() => {
          setError(null);
          setNotice(null);
          setStep('email');
        }}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text className="text-sm font-sans-bold text-heat-strong dark:text-heat-strong-dark">{t('emailUseDifferent')}</Text>
      </Pressable>
    </View>
  );
}
