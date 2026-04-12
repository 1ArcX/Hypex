const CACHE = 'hypex-v3'
const ICON  = '/icon.png'

self.addEventListener('install', e => {
  self.skipWaiting()
  // Pre-cache the shell so notifications can open the app offline
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/icon.png']).catch(() => {}))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Only intercept GET — leave POST/PUT/etc. to pass through unmodified
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data?.json() ?? {} } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title || 'Hypex', {
      body:              data.body  || '',
      icon:              ICON,
      badge:             ICON,
      tag:               data.tag   || 'hypex',
      renotify:          !!data.renotify,
      requireInteraction: false,
      data:              { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const target = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Prefer the window already at the target URL
      const match = list.find(c => c.url.endsWith(target))
      if (match && 'focus' in match) return match.focus()
      // Otherwise focus any open window (SPA — it will navigate itself)
      const any = list.find(c => 'focus' in c)
      if (any) return any.focus()
      return clients.openWindow(target)
    })
  )
})
