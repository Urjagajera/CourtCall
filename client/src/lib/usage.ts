import { api } from './api'

// Calls and voice notes run on Nexconn, so the app reports them for the firm admin's weekly summary (Team page).
// Clients report through their link session; staff through their account.
let path = '/usage'
export function setUsageAudience(client: boolean) {
  path = client ? '/c/usage' : '/usage'
}

/** Fire and forget: usage counting must never get in the way of a call or a message. */
export function logUsage(kind: 'call' | 'voice_note', seconds = 0) {
  api(path, { body: { kind, seconds: Math.max(0, Math.round(seconds)) } }).catch(() => {})
}
