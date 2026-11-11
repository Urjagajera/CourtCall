// CourtCall service worker: makes the site installable as an app and shows client alerts as notifications.
// It never caches live data: courtroom progress must always come fresh from the server.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CourtCall · Offline</title>
<body style="font-family:system-ui,sans-serif;background:#F4EEEA;color:#463B36;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><p style="font-size:20px;font-weight:700;margin:0 0 8px">You're offline</p>
<p style="margin:0 0 16px">CourtCall needs internet to show live courtroom progress.</p>
<button onclick="location.reload()" style="background:#7B3B36;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:16px">Try again</button></div></body>`

// Page loads go to the network; if there is no connection, show a friendly offline page.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
})

self.addEventListener('push', (event) => {
  let data = { title: 'CourtCall', body: 'There is an update on your case.', url: '/case' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    /* plain-text or empty push: keep the default text */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url },
    }),
  )
})

// Tapping the notification opens (or focuses) the case page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/case'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).pathname === url && 'focus' in w) return w.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
