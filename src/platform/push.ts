// Push on the iOS/Android apps (DP-018) goes through Expo's push service
// and needs expo-notifications plus an Expo project, Apple push key and
// Firebase messaging credentials — not set up yet. Until then the native
// apps report push as unsupported and still have the Notifications page.
// The browser implementation is push.web.ts.

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

export function getPushState(): PushState {
  return 'unsupported';
}

export async function enablePush(_locale: string): Promise<PushState> {
  return 'unsupported';
}

export async function syncPush(_locale: string): Promise<void> {}

export async function disablePushOnThisDevice(): Promise<void> {}

export function onNotificationOpened(_handler: (path: string, id: string | null) => void): () => void {
  return () => {};
}

export function takeOpenedNotificationId(): string | null {
  return null;
}
