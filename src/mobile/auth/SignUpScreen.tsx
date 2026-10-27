import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Field } from '../../design-system/ui/Field';
import { IconButton } from '../../design-system/ui/IconButton';
import { Input, InputField } from '../../design-system/ui/Input';
import { PasswordInput } from '../../design-system/ui/PasswordInput';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { USERNAME_PATTERN } from '../../core/auth/firebaseAuth';
import { checkUsername } from '../../core/api/client';
import { signUpErrors, type SignUpErrors } from '../../core/auth/signUpValidation';

type Props = {
  onNavigateToLogin: () => void;
};

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// Create account (Aksi redesign › Create account). Username availability
// is checked as you type; every other problem shows under its own field,
// in danger red, once Sign up is tapped (or, for a mismatched
// confirmation, as soon as one is typed).
export function SignUpScreen({ onNavigateToLogin }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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

  const errors: SignUpErrors = signUpErrors({ username, email, password, confirmPassword });
  const usernameError =
    availability === 'taken'
      ? t('authUsernameTaken')
      : availability === 'invalid'
        ? t('authUsernameInvalid')
        : attempted && errors.username
          ? t('authFieldRequired')
          : null;
  const emailError = attempted && errors.email ? t(errors.email === 'required' ? 'authFieldRequired' : 'authEmailInvalid') : null;
  const passwordError = attempted && errors.password ? t(errors.password === 'required' ? 'authFieldRequired' : 'authPasswordTooShort') : null;
  // A mismatch shows as soon as the confirmation has something in it.
  const confirmError =
    errors.confirmPassword === 'mismatch' && confirmPassword.length > 0
      ? t('authPasswordMismatch')
      : attempted && errors.confirmPassword
        ? t('authFieldRequired')
        : null;

  async function handleSubmit() {
    if (submitting) return;
    setAttempted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0 || availability !== 'available') return;
    setSubmitting(true);
    try {
      await signUp(username, password, email.trim());
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ground dark:bg-ground-dark">
      <View className="min-h-14 flex-row items-center px-1">
        <IconButton icon="chevron-back" label={t('back')} onPress={onNavigateToLogin} />
      </View>
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-4 gap-3.5">
            <View>
              <Typography variant="heading" accessibilityRole="header" className="font-display-hero text-[34px] leading-[38px]">
                {t('authSignUpTitle')}
              </Typography>
              <Typography variant="body" color="muted" className="mt-1">
                {t('authSignUpTagline')}
              </Typography>
            </View>

            <Field
              label={t('authUsername')}
              error={usernameError}
              status={availability === 'available' ? t('authUsernameAvailable') : null}
              hint={availability === 'checking' ? t('authUsernameChecking') : undefined}
            >
              <Input isInvalid={Boolean(usernameError)}>
                <InputField
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username-new"
                  textContentType="username"
                  placeholder={t('authUsernamePlaceholder')}
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase())}
                  maxLength={20}
                />
              </Input>
            </Field>

            <Field label={t('authEmail')} hint={t('authEmailHint')} error={emailError}>
              <Input isInvalid={Boolean(emailError)}>
                <InputField
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  placeholder={t('authEmailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                />
              </Input>
            </Field>

            <Field label={t('authPassword')} error={passwordError}>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                isInvalid={Boolean(passwordError)}
                showLabel={t('authShowPassword')}
                hideLabel={t('authHidePassword')}
              />
            </Field>

            <Field label={t('authConfirmPassword')} error={confirmError ?? serverError}>
              <PasswordInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onSubmitEditing={handleSubmit}
                autoComplete="new-password"
                textContentType="newPassword"
                isInvalid={Boolean(confirmError)}
                showLabel={t('authShowPassword')}
                hideLabel={t('authHidePassword')}
              />
            </Field>
          </View>

          <View className="px-4 pt-3 gap-3 items-center" style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
            <Button size="lg" loading={submitting} isDisabled={submitting} className="w-full" onPress={handleSubmit}>
              <ButtonText>{t('authSignUp')}</ButtonText>
            </Button>
            <Pressable onPress={onNavigateToLogin} accessibilityRole="link" className="py-1 active:opacity-60">
              <Text className="text-sm font-sans text-ink-muted dark:text-ink-muted-dark">
                {t('authHaveAccount')} <Text className="font-sans-bold text-heat-strong dark:text-heat-strong-dark">{t('authLogInLink')}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
