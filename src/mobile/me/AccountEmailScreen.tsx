import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../../components/ui/text';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { EmailConfirmation } from '../auth/EmailConfirmation';
import { AppBar } from '../../design-system/layout/AppBar';

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
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar variant="form" title={t(profile?.email ? 'emailChangeTitle' : 'emailAddTitle')} onClose={onBack} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-6" keyboardShouldPersistTaps="handled">
          <Text className="text-ink-muted dark:text-ink-muted-dark">
            {profile?.email ? t('emailChangeDesc', profile.email) : t('emailAddDesc')}
          </Text>
          <EmailConfirmation onConfirmed={onBack} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
