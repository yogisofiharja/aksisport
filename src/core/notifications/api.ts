import { apiFetch } from '../api/client';
import type { AppNotification } from '../api/types';

// DP-018: the Notifications page and the devices that receive pushes.

export function listNotifications(): Promise<AppNotification[]> {
  return apiFetch('/v1/me/notifications');
}

export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetch('/v1/me/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch(`/v1/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch('/v1/me/notifications/read-all', { method: 'POST' });
}

export function getWebPushPublicKey(): Promise<{ publicKey: string }> {
  return apiFetch('/v1/push/web-public-key');
}

export type DeviceRegistration =
  | { kind: 'web'; endpoint: string; keys: { p256dh: string; auth: string }; locale: string }
  | { kind: 'expo'; token: string; locale: string };

export function registerPushDevice(registration: DeviceRegistration): Promise<void> {
  return apiFetch('/v1/me/push-subscriptions', { method: 'POST', body: JSON.stringify(registration) });
}

// `address` is the web endpoint or the Expo token.
export function unregisterPushDevice(address: string): Promise<void> {
  return apiFetch('/v1/me/push-subscriptions', { method: 'DELETE', body: JSON.stringify({ address }) });
}
