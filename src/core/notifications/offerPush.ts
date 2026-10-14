import { appAlert } from '../../design-system/feedback/appAlert';
import { storageGet, storageSave } from '../../storage';
import { enablePush, getPushState } from '../../platform/push';

const DISMISSED_KEY = 'aksi.pushOfferDismissed';

// DP-018: permission is asked at a moment where notifications obviously
// help — right after joining or asking to join — never on first launch.
// Our own explanation comes first; only "Turn on" triggers the browser's
// prompt (from that tap, as browsers require). "Not now" is remembered on
// this device, and the Notifications page still offers to turn them on.
export async function offerPush(lang: string, t: (key: string) => string): Promise<void> {
  if (getPushState() !== 'default') return;
  const dismissed = await storageGet(DISMISSED_KEY).catch(() => null);
  if (dismissed) return;
  appAlert(t('pushOfferTitle'), t('pushOfferDesc'), [
    {
      text: t('pushOfferLater'),
      style: 'cancel',
      onPress: () => {
        storageSave(DISMISSED_KEY, '1').catch(() => {});
      },
    },
    {
      text: t('pushTurnOn'),
      onPress: () => {
        enablePush(lang).catch(() => {});
      },
    },
  ]);
}
