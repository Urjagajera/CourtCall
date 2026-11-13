import { api } from './api'

// Phone notifications (Web Push) for the client page and for lawyers/staff (Settings). Works on Android Chrome
// and desktop browsers; on iPhone only after "Add to Home Screen" (iOS 16.4+).

/** Whose alerts: the client's case page, or a signed-in lawyer/junior/staff member. */
export type PushTarget = 'client' | 'staff'
const paths = {
  client: { key: '/c/push-key', on: '/c/push', off: '/c/push/off' },
  staff: { key: '/push/key', on: '/push', off: '/push/off' },
}

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function pushState(target: PushTarget = 'client'): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub || Notification.permission !== 'granted') return 'off'
  // Staff: this browser may be subscribed for someone else (or for a client page), so ask the server.
  if (target === 'staff') {
    const { on } = await api<{ on: boolean }>('/push/status', { body: { endpoint: sub.endpoint } }).catch(() => ({ on: false }))
    return on ? 'on' : 'off'
  }
  return 'on'
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Asks permission, subscribes this phone and registers it (for this case's link, or for the signed-in staff member). */
export async function turnOnPush(target: PushTarget = 'client'): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const { publicKey } = await api<{ publicKey: string }>(paths[target].key)
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  await api(paths[target].on, { body: sub.toJSON() })
  return 'on'
}

export async function turnOffPush(target: PushTarget = 'client'): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api(paths[target].off, { body: { endpoint: sub.endpoint } }).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}
