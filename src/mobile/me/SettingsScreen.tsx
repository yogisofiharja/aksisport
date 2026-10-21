import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation, type Lang } from '../../i18n';
import { useTheme, type ThemePreference } from '../../theme';
import { useAuth } from '../../core/auth/AuthContext';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  onBack: () => void;
  onOpenBlocked: () => void;
  onOpenNotifications: () => void;
};

const THEME_OPTIONS: { value: ThemePreference; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline'; labelKey: 'followDevice' | 'light' | 'dark' }[] = [
  { value: 'system', icon: 'phone-portrait-outline', labelKey: 'followDevice' },
  { value: 'light', icon: 'sunny-outline', labelKey: 'light' },
  { value: 'dark', icon: 'moon-outline', labelKey: 'dark' },
];

export function SettingsScreen({ onBack, onOpenBlocked, onOpenNotifications }: Props) {
  const { t, lang, setLang } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { signOut } = useAuth();

  return (
    <ScrollPage gap="lg" appBar={<AppBar title={t('settingsTitle')} onBack={onBack} />}>

      <VStack space="sm">
        <Typography variant="label" color="muted">
          {t('languageSection')}
        </Typography>
        <HStack space="sm">
          {(['en', 'id'] as Lang[]).map((l) => (
            <Button
              key={l}
              className="flex-1"
              variant={lang === l ? 'solid' : 'outline'}
              onPress={() => setLang(l)}
            >
              <ButtonText variant={lang === l ? 'solid' : 'outline'}>
                {l === 'en' ? t('english') : t('indonesian')}
              </ButtonText>
            </Button>
          ))}
        </HStack>
      </VStack>

      <VStack space="sm">
        <Typography variant="label" color="muted">
          {t('displayTheme')}
        </Typography>
        <VStack space="sm">
          {THEME_OPTIONS.map((opt) => {
            const selected = preference === opt.value;
            return (
              <Card key={opt.value} pressable onPress={() => setPreference(opt.value)}>
                <HStack className="justify-between items-center" space="md">
                  <HStack space="md" className="items-center">
                    <Icon name={opt.icon} color={selected ? 'secondary' : 'muted'} />
                    <Typography variant="body" color={selected ? 'secondary' : 'default'} className="text-lg font-bold">
                      {t(opt.labelKey)}
                    </Typography>
                  </HStack>
                  {selected && <Icon name="checkmark-circle" color="secondary" />}
                </HStack>
              </Card>
            );
          })}
        </VStack>
      </VStack>

      <Card pressable onPress={onOpenNotifications}>
        <HStack className="justify-between items-center" space="md">
          <HStack space="md" className="items-center">
            <Icon name="notifications-outline" color="muted" />
            <Typography variant="body" className="text-lg font-bold">
              {t('notificationSettingsTitle')}
            </Typography>
          </HStack>
          <Icon name="chevron-forward" size="sm" color="muted" />
        </HStack>
      </Card>

      <VStack space="sm">
        <Typography variant="label" color="muted">
          {t('privacySection')}
        </Typography>
        <Card pressable onPress={onOpenBlocked}>
          <HStack className="justify-between items-center" space="md">
            <HStack space="md" className="items-center">
              <Icon name="ban-outline" color="muted" />
              <Typography variant="body" className="text-lg font-bold">
                {t('blockedPlayersTitle')}
              </Typography>
            </HStack>
            <Icon name="chevron-forward" size="sm" color="muted" />
          </HStack>
        </Card>
      </VStack>

      <Button action="negative" variant="outline" size="xl" className="w-full" onPress={signOut}>
        <ButtonText action="negative" variant="outline">
          {t('logout')}
        </ButtonText>
      </Button>
    </ScrollPage>
  );
}
