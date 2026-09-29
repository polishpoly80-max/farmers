import api from './api'

const SERVICE_WORKER_PATH = '/push-sw.js'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(character => character.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushStatus() {
  if (!isPushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    registration,
    subscription,
  }
}

export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser')
  if (!window.isSecureContext) throw new Error('Push notifications require HTTPS or localhost')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted')

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' })
  const { public_key: publicKey } = await api.get('/notifications/vapid-public-key')
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await api.post('/notifications/subscribe', subscription.toJSON())
  return subscription
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await api.post('/notifications/unsubscribe', subscription.toJSON()).catch(() => {})
    await subscription.unsubscribe()
  }
}

export async function autoEnablePushNotifications() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' })
  const { public_key: publicKey } = await api.get('/notifications/vapid-public-key')
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  await api.post('/notifications/subscribe', subscription.toJSON())
  return true
}

export async function preparePushNotifications() {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return permission
  }
  if (Notification.permission === 'granted') {
    await autoEnablePushNotifications()
    return 'granted'
  }
  return Notification.permission
}

export async function notifyOrderPlaced(orderId) {
  if (!isPushSupported() || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration()
  const worker = registration?.active || registration?.waiting || registration?.installing
  const payload = {
    type: 'order',
    orderId,
    title: 'Order placed successfully',
    body: `Order ${orderId} is being prepared.`,
  }
  if (worker) {
    worker.postMessage(payload)
  } else {
    new Notification(payload.title, {
      body: payload.body,
      icon: '/images/farm-chicken.jpg',
      tag: `order-${orderId}`,
    })
  }
  return true
}

export async function notifyLogin() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration()
  const worker = registration?.active || registration?.waiting || registration?.installing
  if (!worker) return false
  worker.postMessage({
    type: 'login',
    title: 'New account login',
    body: 'Your Premium Poultry Farm account was just signed in.',
  })
  return true
}

export async function sendTestPushNotification() {
  return api.post('/notifications/test', {})
}
