import { useEffect, useState } from 'react';
import { Pressable, Switch } from 'react-native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Loading } from '../../design-system/feedback/Loading';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationCategory,
  type NotificationSettings,
} from '../../core/notifications/api';

type Props = {
  onBack: () => void;
};

// One switch per kind (DP-018), in this order.
const KINDS: Array<{ category: NotificationCategory; label: string; hint: string }> = [
  { category: 'community_requests', label: 'notifSettingCommunityRequests', hint: 'notifSettingCommunityRequestsHint' },
  { category: 'session_requests', label: 'notifSettingSessionRequests', hint: 'notifSettingSessionRequestsHint' },
  { category: 'payments', label: 'notifSettingPayments', hint: 'notifSettingPaymentsHint' },
  { category: 'session_reminders', label: 'notifSettingReminders', hint: 'notifSettingRemindersHint' },
];

// Settings › Notifications (DP-018): which kinds push to this person's
// devices, all on by default. Turning one off stops its pushes; its
// notifications still appear on the Notifications page.
export function NotificationSettingsScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    getNotificationSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  function toggle(category: NotificationCategory, enabled: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [category]: enabled });
    updateNotificationSettings({ [category]: enabled })
      .then(setSettings)
      .catch(() => {
        setSettings(previous);
        appAlert(t('notificationSettingsFailed'));
      });
  }

  return (
    <ScrollPage gap="lg">
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>
      <VStack space="xs">
        <Typography variant="display">{t('notificationSettingsTitle')}</Typography>
        <Typography variant="body" color="muted">
          {t('notificationSettingsExplainer')}
        </Typography>
      </VStack>

      {!settings ? (
        <Loading />
      ) : (
        <VStack space="md">
          {KINDS.map((kind) => (
            <Card key={kind.category}>
              <HStack className="items-center" space="md">
                <VStack space="xs" style={{ flex: 1 }}>
                  <Typography variant="body" className="text-lg font-bold">
                    {t(kind.label)}
                  </Typography>
                  <Typography variant="body" color="muted" className="text-sm">
                    {t(kind.hint)}
                  </Typography>
                </VStack>
                <Switch
                  value={settings[kind.category]}
                  onValueChange={(value) => toggle(kind.category, value)}
                  trackColor={{ true: '#2563eb', false: undefined }}
                  accessibilityLabel={t(kind.label)}
                />
              </HStack>
            </Card>
          ))}
        </VStack>
      )}
    </ScrollPage>
  );
}
