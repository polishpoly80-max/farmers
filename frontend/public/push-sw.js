/* Premium Poultry Farm - push service worker */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

/** Pick the in-app route a notification should open. */
function resolveTarget(payload) {
  if (payload.url) return payload.url
  const type = payload.data?.type || payload.type
  if (type === 'order_update' || type === 'order') return '/dashboard'
  if (type === 'login') return '/dashboard'
  if (type === 'stock_alert') return '/admin'
  if (type === 'announcement') return '/products'
  if (type === 'cart_reminder') return '/cart'
  if (type === 'care_request' || type === 'care_message' || type === 'care_status') return '/care-chat'
  return '/'
}

// The app icons ship with the PWA manifest; using them keeps notifications and
// the installed app looking like one product instead of two.
const APP_ICON = '/icon-192.png'

self.addEventListener('push', event => {
  let payload = { title: 'Premium Poultry Farm', body: 'You have a new update.' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  const target = resolveTarget(payload)
  const options = {
    body: payload.body,
    icon: APP_ICON,
    badge: APP_ICON,
    tag: payload.tag || payload.data?.type || 'farm-notification',
    data: { ...(payload.data || {}), url: target },
    vibrate: [120, 60, 120],
    requireInteraction: false,
  }

  event.waitUntil(
    (async () => {
      // Keep an already-visible notification from stacking a duplicate.
      const existing = await self.registration.getNotifications({ tag: options.tag })
      existing.forEach(n => n.close())
      await self.registration.showNotification(payload.title, options)

      // If a tab is open, let it refresh its in-app notification list.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      clients.forEach(client => client.postMessage({ type: 'PUSH_RECEIVED', payload }))
    })()
  )
})

self.addEventListener('message', event => {
  const data = event.data || {}
  if (data.type === 'login') {
    event.waitUntil(self.registration.showNotification(data.title || 'New account login', {
      body: data.body || 'Your Premium Poultry Farm account was just signed in.',
      icon: APP_ICON,
      badge: APP_ICON,
      tag: 'account-login',
      data: { type: 'login', url: '/dashboard' },
    }))
  }
  if (data.type === 'order') {
    event.waitUntil(self.registration.showNotification(data.title || 'Order placed successfully', {
      body: data.body || 'Your order is being prepared.',
      icon: APP_ICON,
      badge: APP_ICON,
      tag: `order-${data.orderId || 'new'}`,
      data: { type: 'order', orderId: data.orderId, url: '/dashboard' },
    }))
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Prefer a tab already sitting on the target route.
      const exact = clients.find(c => c.url && new URL(c.url).pathname === target)
      const anyWindow = clients.find(c => 'focus' in c)
      if (exact) return exact.focus()
      if (anyWindow) {
        return anyWindow.navigate(target).then(c => c && c.focus())
      }
      return self.clients.openWindow(target)
    })
  )
})
