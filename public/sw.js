self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Regen alert', {
      body: data.body || 'Er komt regen aan!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'rain-alert',
      renotify: true,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === '/' && 'focus' in client) return client.focus()
      }
      return clients.openWindow('/')
    })
  )
})
