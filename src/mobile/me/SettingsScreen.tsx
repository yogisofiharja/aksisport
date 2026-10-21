import { useCallback, useState } from 'react';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { AppBar } from '../../design-system/layout/AppBar';
import { Typography } from '../../design-system/ui/Typography';
import { Segmented } from '../../design-system/ui/Segmented';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { useTranslation, type Lang } from '../../i18n';
import { useTheme, type ThemePreference } from '../../theme';
import { useAuth } from '../../core/auth/AuthContext';
import { getNotificationSettings } from '../../core/notifications/api';
import { listMyBlocks } from '../../core/safety/api';

type Props = {
  onBack: () => void;
  onOpenBlocked: () => void;
  onOpenNotifications: () => void;
};

// Settings (Aksi redesign › Settings): theme and language as Segmented
// controls that apply at once, then grouped rows, Log out last, then the
// app version.
export function SettingsScreen({ onBack, onOpenBlocked, onOpenNotifications }: Props) {
  const { t, lang, setLang } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { signOut } = useAuth();
  const [kinds, setKinds] = useState<{ on: number; total: number } | null>(null);
  const [blocked, setBlocked] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      getNotificationSettings()
        .then((s) => {
          const values = Object.values(s);
          setKinds({ on: values.filter(Boolean).length, total: values.length });
        })
        .catch(() => {});
      listMyBlocks()
        .then((b) => setBlocked(b.length))
        .catch(() => {});
    }, [])
  );

  return (
    <ScrollPage gap="lg" appBar={<AppBar title={t('settingsTitle')} onBack={onBack} />}>
      <VStack space="sm">
        <Typography variant="overline" color="muted">
          {t('displayTheme')}
        </Typography>
        <Segmented<ThemePreference>
          options={[
            { value: 'light', label: t('light') },
            { value: 'dark', label: t('dark') },
            { value: 'system', label: t('followDevice') },
          ]}
          value={preference}
          onChange={setPreference}
        />
      </VStack>

      <VStack space="sm">
        <Typography variant="overline" color="muted">
          {t('languageSection')}
        </Typography>
        <Segmented<Lang>
          options={[
            { value: 'en', label: t('english') },
            { value: 'id', label: t('indonesian') },
          ]}
          value={lang}
          onChange={setLang}
        />
      </VStack>

      <VStack space="sm">
        <Typography variant="overline" color="muted">
          {t('settingsNotificationsPrivacy')}
        </Typography>
        <ListGroup>
          <ListRow
            icon="notifications-outline"
            title={t('notificationSettingsTitle')}
            subtitle={kinds ? t('settingsKindsOn', kinds.on, kinds.total) : undefined}
            chevron
            onPress={onOpenNotifications}
          />
          <ListRow
            icon="ban-outline"
            title={t('blockedPlayersTitle')}
            subtitle={blocked != null ? t('settingsBlockedCount', blocked) : undefined}
            chevron
            onPress={onOpenBlocked}
          />
        </ListGroup>
      </VStack>

      <ListGroup>
        <ListRow icon="log-out-outline" title={t('logout')} danger onPress={signOut} />
      </ListGroup>

      <Typography variant="caption" color="muted" className="text-center">
        {t('settingsVersion', Constants.expoConfig?.version ?? '')}
      </Typography>
    </ScrollPage>
  );
}
