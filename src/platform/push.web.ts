import { getWebPushPublicKey, registerPushDevice, unregisterPushDevice } from '../core/notifications/api';

// Browser push (DP-018): standard Web Push through public/sw.js. On an
// iPhone this only exists once Aksi has been added to the home screen.

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushState(): PushState {
  if (!supported()) return 'unsupported';
  return Notification.permission as PushState;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const bytes = new Uint8Array(a);
  return bytes.length === b.length && bytes.every((v, i) => v === b[i]);
}

// Makes sure this browser has a subscription made with the server's
// current key, and that the server has it for the signed-in person.
async function subscribe(locale: string): Promise<void> {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await getWebPushPublicKey();
  const key = base64UrlToBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    // Made with an older key (e.g. another environment); it would never
    // receive anything from this server.
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('incomplete push subscription');
  await registerPushDevice({
    kind: 'web',
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    locale,
  });
}

// Asks the browser for permission, then registers this device. Must be
// called straight from a tap: browsers only show the permission prompt in
// response to one.
export async function enablePush(locale: string): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribe(locale);
  return permission as PushState;
}

// On sign-in (and when the app language changes): if push is already
// allowed here, re-register this device for whoever is signed in now.
export async function syncPush(locale: string): Promise<void> {
  if (getPushState() !== 'granted') return;
  await subscribe(locale);
}

// On sign-out: the server stops pushing to this browser. The browser keeps
// its subscription, so signing in again re-registers it without a prompt.
export async function disablePushOnThisDevice(): Promise<void> {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await unregisterPushDevice(subscription.endpoint);
}

// A notification tapped while an Aksi tab is open (see sw.js).
export function onNotificationOpened(handler: (path: string, id: string | null) => void): () => void {
  if (!supported()) return () => {};
  const listener = (event: MessageEvent) => {
    if (event.data?.type === 'aksi-open-notification') handler(event.data.path, event.data.id ?? null);
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}

// A notification tapped while no Aksi tab was open arrives as ?notif=<id>
// on the address it opened. Returns that id once and removes it from the
// address bar.
export function takeOpenedNotificationId(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const id = url.searchParams.get('notif');
  if (!id) return null;
  url.searchParams.delete('notif');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return id;
}
