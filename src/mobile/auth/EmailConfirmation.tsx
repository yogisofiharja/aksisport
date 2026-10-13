import { useState } from 'react';
import { Button, ButtonText } from '../../../components/ui/button';
import { VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { ApiRequestError, confirmEmailCode, requestEmailCode } from '../../core/api/client';
import { RESEND_COOLDOWN_SECONDS, useCountdown } from '../../core/useCountdown';

type Props = {
  // Called once the code is accepted and the profile has been refreshed.
  onConfirmed?: () => void;
};

// The two-step email confirmation (DP-015): give an address, then enter
// the 6-digit code sent to it. Shared by the sign-up gate
// (VerifyEmailScreen) and the Me tab's add/change email screen
// (AccountEmailScreen). Opens on the code step when a code is already
// outstanding (profile.pendingEmail), which is the normal case right
// after sign-up.
export function EmailConfirmation({ onConfirmed }: Props) {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>(profile?.pendingEmail ? 'code' : 'email');
  const [email, setEmail] = useState(profile?.pendingEmail ?? '');
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

  async function confirm() {
    if (code.trim().length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await confirmEmailCode(code.trim());
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
      <VStack className="gap-4">
        <VStack className="gap-2">
          <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('authEmail')}</Text>
          <Input>
            <InputField
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={t('authEmailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => sendCode(false)}
            />
          </Input>
        </VStack>
        {error && <Text className="text-sm text-red-500">{error}</Text>}
        <Button
          action="secondary"
          size="xl"
          isDisabled={busy || !email.trim()}
          className="w-full rounded-2xl bg-blue-600"
          onPress={() => sendCode(false)}
        >
          <ButtonText className="text-white text-xl">{t('emailSendCode')}</ButtonText>
        </Button>
      </VStack>
    );
  }

  return (
    <VStack className="gap-4">
      <Text className="text-slate-500 dark:text-slate-400">{t('emailCodeSentTo', email.trim())}</Text>
      <VStack className="gap-2">
        <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('emailCodeLabel')}</Text>
        <Input>
          <InputField
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            onSubmitEditing={confirm}
          />
        </Input>
      </VStack>
      {error && <Text className="text-sm text-red-500">{error}</Text>}
      {notice && <Text className="text-sm text-slate-500 dark:text-slate-400">{notice}</Text>}
      <Button
        action="secondary"
        size="xl"
        isDisabled={busy || code.trim().length !== 6}
        className="w-full rounded-2xl bg-blue-600"
        onPress={confirm}
      >
        <ButtonText className="text-white text-xl">{t('emailConfirm')}</ButtonText>
      </Button>
      <VStack className="gap-3 items-center">
        {resendIn > 0 ? (
          <Text className="font-bold text-slate-400 dark:text-slate-500">{t('emailResendIn', resendIn)}</Text>
        ) : (
          <Pressable onPress={() => sendCode(true)} disabled={busy}>
            <Text className="font-bold text-blue-600 dark:text-blue-400">{t('emailResendCode')}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            setError(null);
            setNotice(null);
            setStep('email');
          }}
          disabled={busy}
        >
          <Text className="font-bold text-blue-600 dark:text-blue-400">{t('emailUseDifferent')}</Text>
        </Pressable>
      </VStack>
    </VStack>
  );
}
