import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../../components/ui/button';
import { VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
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
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center px-6">
      <VStack className="gap-4 items-center">
        <Heading size="xl" className="text-center">{t('authCompleteProfileTitle')}</Heading>
        <Text className="text-center text-slate-500 dark:text-slate-400">{t('authCompleteProfileDesc')}</Text>
        {error && <Text className="text-sm text-red-500">{error}</Text>}
        <Button
          action="secondary"
          size="xl"
          isDisabled={submitting || !username}
          className="w-full rounded-2xl bg-blue-600"
          onPress={handleContinue}
        >
          <ButtonText className="text-white text-xl">{t('authContinue')}</ButtonText>
        </Button>
      </VStack>
    </SafeAreaView>
  );
}
