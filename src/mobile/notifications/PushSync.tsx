import { useEffect } from 'react';
import { useLinkTo } from '@react-navigation/native';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { markNotificationRead } from '../../core/notifications/api';
import { onNotificationOpened, syncPush, takeOpenedNotificationId } from '../../platform/push';

// Keeps this device's push registration in step with the signed-in person
// and the app language (DP-018), and handles a tapped notification. Renders
// nothing; mounted once inside the navigator for signed-in use.
export function PushSync() {
  const { lang } = useTranslation();
  const { profile } = useAuth();
  const linkTo = useLinkTo();

  // Re-register on sign-in and when the language changes, so pushes come
  // to whoever is signed in here, in the language they use.
  useEffect(() => {
    if (!profile?.id) return;
    syncPush(lang).catch(() => {});
  }, [profile?.id, lang]);

  useEffect(() => {
    // Opened from a notification while no Aksi tab was open: the address
    // is already the right screen; it only needs marking read.
    const openedId = takeOpenedNotificationId();
    if (openedId) markNotificationRead(openedId).catch(() => {});

    // Tapped while Aksi is open: go there in place.
    return onNotificationOpened((path, id) => {
      if (id) markNotificationRead(id).catch(() => {});
      linkTo(path);
    });
  }, [linkTo]);

  return null;
}
