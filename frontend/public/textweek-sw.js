// TextWeek Custom Push Service Worker

self.addEventListener('push', (event) => {
  const payload = event.data && event.data.json ? event.data.json() : {};
  const title = payload?.notification?.title || 'TextWeek';
  const body = payload?.notification?.body || 'You have a new message';

  const options = {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'textweek-message',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const appUrl = self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingWindow = clientList.find((client) => client.url.startsWith(appUrl) && 'focus' in client);

      if (existingWindow) {
        return existingWindow.focus();
      }

      return clients.openWindow(appUrl);
    })
  );
});
