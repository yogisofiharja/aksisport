import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Illustration } from '../../design-system/feedback/Illustration';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { EmailConfirmation } from './EmailConfirmation';

// The gate a new account sits behind until its email is confirmed
// (DP-015; Aksi redesign › Confirm your email). Shown by RootNavigator
// instead of the app while useAuth().needsEmail is true; confirming flips
// that and the app appears, so there is nothing to navigate to from here.
// Log out, top right, is the only other way off this screen.
// `initialEmail` opens straight on the code step for that address (the
// dev gallery, which has no pending code to read).
export function VerifyEmailScreen({ initialEmail }: { initialEmail?: string } = {}) {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <View className="min-h-14 flex-row items-center justify-end px-2">
        <Pressable onPress={signOut} accessibilityRole="button" className="px-2 py-2.5 active:opacity-60">
          <Text className="text-sm font-sans-semibold text-ink-muted dark:text-ink-muted-dark">{t('logout')}</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-4 pt-2 pb-8 gap-5" keyboardShouldPersistTaps="handled">
          <View className="self-start">
            <Illustration name="email" />
          </View>
          <Typography variant="heading" accessibilityRole="header" className="font-display-hero text-[34px] leading-[38px]">
            {t('emailVerifyTitle')}
          </Typography>
          <EmailConfirmation initialEmail={initialEmail} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
