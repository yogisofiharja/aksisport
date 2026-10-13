import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { EmailConfirmation } from './EmailConfirmation';

// The gate a new account sits behind until its email is confirmed
// (DP-015). Shown by RootNavigator instead of the app while
// useAuth().needsEmail is true; confirming flips that and the app
// appears, so there is nothing to navigate to from here. Logging out is
// the only other way off this screen.
export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-8 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <VStack className="gap-2">
            <Heading size="2xl">{t('emailVerifyTitle')}</Heading>
            <Text className="text-slate-500 dark:text-slate-400">{t('emailVerifyDesc')}</Text>
          </VStack>
          <EmailConfirmation />
          <Pressable className="self-center" onPress={signOut}>
            <Text className="text-slate-500 dark:text-slate-400">{t('logout')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
