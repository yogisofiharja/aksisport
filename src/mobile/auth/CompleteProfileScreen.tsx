import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { emailToUsername } from '../../core/auth/firebaseAuth';
import { createProfile } from '../../core/api/client';

// Reached only when Firebase sign-up succeeded but POST /v1/users never
// completed (e.g. the app was killed mid-signup) — recovers the username
// from the Firebase account's synthetic email and retries profile creation.
export function CompleteProfileScreen() {
  const { t } = useTranslation();
  const { firebaseUser, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = emailToUsername(firebaseUser?.email);

  async function handleContinue() {
    if (!username) return;
    setSubmitting(true);
    setError(null);
    try {
      await createProfile(username);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark justify-center px-4">
      <View className="gap-5">
        <View className="gap-1">
          <Typography variant="heading" accessibilityRole="header" className="font-display-hero text-[34px] leading-[38px]">
            {t('authCompleteProfileTitle')}
          </Typography>
          <Typography variant="body" color="muted">
            {t('authCompleteProfileDesc')}
          </Typography>
        </View>
        <View className="gap-1.5">
          <Button size="lg" loading={submitting} isDisabled={submitting || !username} className="w-full" onPress={handleContinue}>
            <ButtonText>{t('authContinue')}</ButtonText>
          </Button>
          {error ? <Text className="text-xs leading-4 font-sans-semibold text-danger dark:text-danger-dark">{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
