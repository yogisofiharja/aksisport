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
    case 'community_join_approved':
      return t('notifCommunityJoinApproved', p.club ?? '');
    case 'session_join_request':
      return t('notifSessionJoinRequest', p.name ?? '', p.session ?? '');
    case 'session_join_approved':
      // A free Session: approval already claimed the spot.
      return p.claimed === '1' ? t('notifSessionJoinApprovedFree', p.session ?? '') : t('notifSessionJoinApproved', p.session ?? '');
    case 'payment_receipt':
      return t('notifPaymentReceipt', p.name ?? '', p.session ?? '');
    case 'payment_confirmed':
      return t('notifPaymentConfirmed', p.session ?? '');
    case 'session_reminder':
      return t('notifSessionReminder', p.session ?? '', startsIn(Number(p.minutes), t));
    case 'umpire_assigned':
      return t('notifUmpireAssigned', p.session ?? '');
    default:
      return t('notifGeneric');
  }
}

// "in 2 hours", "in 1 hour 30 minutes", "in 45 minutes" — how long until a
// Session starts, when its reminder was sent.
export function startsIn(minutes: number, t: T): string {
  const total = Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 1));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(t('durationHours', hours));
  if (mins > 0) parts.push(t('durationMinutes', mins));
  return t('startsIn', parts.join(' '));
}

export function notificationIcon(type: string): ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'community_join_request':
    case 'session_join_request':
      return 'person-add-outline';
    case 'community_join_approved':
    case 'session_join_approved':
      return 'checkmark-circle-outline';
    case 'payment_receipt':
      return 'receipt-outline';
    case 'payment_confirmed':
      return 'wallet-outline';
    case 'session_reminder':
      return 'alarm-outline';
    case 'umpire_assigned':
      return 'flag-outline';
    default:
      return 'notifications-outline';
  }
}

// "just now", "5 min ago", "3 h ago", "2 d ago", then the date.
// After a week, the date: "14 Oct" ("14 Okt"), with the year only when it
// isn't this year ("14 Oct 2025").
export function timeAgo(iso: string, t: T, lang: 'en' | 'id' = 'en', now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('timeJustNow');
  if (seconds < 3600) return t('timeMinutesAgo', Math.floor(seconds / 60));
  if (seconds < 86400) return t('timeHoursAgo', Math.floor(seconds / 3600));
  if (seconds < 7 * 86400) return t('timeDaysAgo', Math.floor(seconds / 86400));
  const date = new Date(iso);
  return date
    .toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    })
    .replace('.', '');
}
