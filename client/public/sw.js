// CourtCall service worker: shows client alerts as phone notifications.
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
