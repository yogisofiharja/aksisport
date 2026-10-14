// Aksi service worker — push notifications only (DP-018). No caching, no
// offline behaviour: it exists so the browser can show a notification
// while Aksi is closed, and open the right screen when one is tapped.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Payload sent by the server (internal/notify): {title, body, path, id}.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Aksi';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/favicon.ico',
      tag: data.id || undefined,
      data: { path: data.path || '/', id: data.id || null },
    })
  );
});

// Tapping a notification: an open Aksi tab is focused and told where to
// go (it navigates in place and marks the notification read); otherwise a
// new tab opens at that address, carrying the id so the app can mark it
// read once it has signed the person in.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { path, id } = event.notification.data || {};
  const target = new URL(path || '/', self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: 'aksi-open-notification', path: target.pathname, id });
        return;
      }
      if (id) target.searchParams.set('notif', id);
      await self.clients.openWindow(target.href);
    })()
  );
});
