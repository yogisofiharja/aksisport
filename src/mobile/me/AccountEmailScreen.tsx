import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { EmailConfirmation } from '../auth/EmailConfirmation';

type Props = {
  onBack: () => void;
};

// Add or change the caller's own email from the Me tab (DP-015). The
// current confirmed email, if any, stays in effect until the new one's
// code is entered.
export function AccountEmailScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>
          <VStack className="gap-2">
            <Heading size="2xl">{t(profile?.email ? 'emailChangeTitle' : 'emailAddTitle')}</Heading>
            <Text className="text-slate-500 dark:text-slate-400">
              {profile?.email ? t('emailChangeDesc', profile.email) : t('emailAddDesc')}
            </Text>
          </VStack>
          <EmailConfirmation onConfirmed={onBack} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
