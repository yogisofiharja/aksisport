import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { AppNotification } from '../api/types';

type T = (key: string, ...args: any[]) => string;

// How a notification reads on the Notifications page, in the app's
// current language. The server stores only type + params; the push text
// for the same types lives server-side in internal/notify/texts.go —
// keep the two in step.
export function notificationText(n: AppNotification, t: T): string {
  const p = n.params ?? {};
  switch (n.type) {
    case 'community_join_request':
      return t('notifCommunityJoinRequest', p.name ?? '', p.club ?? '');
    default:
      return t('notifGeneric');
  }
}

export function notificationIcon(type: string): ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'community_join_request':
      return 'person-add-outline';
    default:
      return 'notifications-outline';
  }
}

// "just now", "5 min ago", "3 h ago", "2 d ago", then the date.
export function timeAgo(iso: string, t: T, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('timeJustNow');
  if (seconds < 3600) return t('timeMinutesAgo', Math.floor(seconds / 60));
  if (seconds < 86400) return t('timeHoursAgo', Math.floor(seconds / 3600));
  if (seconds < 7 * 86400) return t('timeDaysAgo', Math.floor(seconds / 86400));
  return new Date(iso).toLocaleDateString();
}
