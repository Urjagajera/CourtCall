import { api, type User } from './api'

// Real accounts: "tour seen" is saved on the server, so it shows once per person on any device.
// Shared demo accounts: saved per browser, so every judge/tester trying a demo account gets the tour.

const isDemo = (u: User) => u.email.endsWith('@courtcall.demo')
const key = (u: User) => `cc-tour-done:${u.id}`

export function tourSeen(u: User) {
  if (!isDemo(u)) return Boolean(u.tourCompletedAt)
  try {
    return localStorage.getItem(key(u)) === '1'
  } catch {
    return true // no storage (private mode): don't nag on every page load
  }
}

export async function markTourSeen(u: User) {
  if (isDemo(u)) {
    try {
      localStorage.setItem(key(u), '1')
    } catch {
      /* ignore */
    }
    return
  }
  await api('/auth/tour', { method: 'POST' }).catch(() => {})
}

/** "Adv. Rakesh Mehta" -> "Rakesh" (skips honorifics common in Indian legal practice). */
export function firstName(name: string) {
  const honorifics = /^(adv|advocate|dr|mr|mrs|ms|shri|smt|sri|kum)\.?$/i
  return name.split(/\s+/).find((w) => !honorifics.test(w)) ?? name
}
