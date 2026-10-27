import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthHero } from '../../design-system/layout/AuthHero';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Field } from '../../design-system/ui/Field';
import { Input, InputField } from '../../design-system/ui/Input';
import { PasswordInput } from '../../design-system/ui/PasswordInput';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';

type Props = {
  onNavigateToSignUp: () => void;
  onForgotPassword: () => void;
};

// Log in (Aksi redesign › Log in): the dark hero over the form, no app
// bar. A failed log in shows under the password, not as an alert.
export function LoginScreen({ onNavigateToSignUp, onForgotPassword }: Props) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
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
    <View className="flex-1 bg-ground dark:bg-ground-dark">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <AuthHero title={t('authLoginTitle')} subtitle={t('authLoginTagline')} />

          <View className="flex-1 px-4 pt-6 gap-4">
            <Field label={t('authUsernameOrEmail')}>
              <Input>
                <InputField
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  value={username}
                  onChangeText={(v) => {
                    setUsername(v.toLowerCase());
                    setError(null);
                  }}
                />
              </Input>
            </Field>

            <Field label={t('authPassword')} error={error}>
              <PasswordInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                onSubmitEditing={handleSubmit}
                autoComplete="current-password"
                textContentType="password"
                isInvalid={Boolean(error)}
                showLabel={t('authShowPassword')}
                hideLabel={t('authHidePassword')}
              />
            </Field>

            <Pressable className="self-end -mt-1.5 py-1.5 active:opacity-60" onPress={onForgotPassword} accessibilityRole="link">
              <Text className="text-sm font-sans-semibold text-heat-strong dark:text-heat-strong-dark">{t('forgotPasswordLink')}</Text>
            </Pressable>
          </View>

          <View className="px-4 pt-3 gap-3 items-center" style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
            <Button size="xl" isDisabled={!canSubmit} loading={submitting} className="w-full" onPress={handleSubmit}>
              <ButtonText>{t('authLogIn')}</ButtonText>
            </Button>
            <Pressable onPress={onNavigateToSignUp} accessibilityRole="link" className="py-1 active:opacity-60">
              <Text className="text-sm font-sans text-ink-muted dark:text-ink-muted-dark">
                {t('authNoAccount')} <Text className="font-sans-bold text-heat-strong dark:text-heat-strong-dark">{t('authCreateAccount')}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
