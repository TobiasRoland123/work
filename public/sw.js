// Service worker: makes the app installable and shows push notifications.
// Pages are not cached, so attendance is always read fresh from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'WØRK', {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      data: { url: payload.url || '/today' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/today', self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (!open) return self.clients.openWindow(target.href);
      return open.focus().then(() => open.navigate(target.href));
    })
  );
});
