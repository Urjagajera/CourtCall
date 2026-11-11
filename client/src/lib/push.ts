import { api } from './api'

// Phone notifications for the client page (Web Push). Works on Android Chrome and desktop browsers;
// on iPhone only after "Add to Home Screen" (iOS 16.4+).

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Asks permission, subscribes this phone and registers it for this case's link. */
export async function turnOnPush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const { publicKey } = await api<{ publicKey: string }>('/c/push-key')
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  await api('/c/push', { body: sub.toJSON() })
  return 'on'
}

export async function turnOffPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api('/c/push/off', { body: { endpoint: sub.endpoint } }).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}
