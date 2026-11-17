// Keeps this device's clock in step with the CourtCall server, so "Tap to screen 0.4 s" is honest even when
// a phone's clock is off. Uses /api/time (answers instantly, no database), takes the sample with the
// shortest round trip, and assumes the server read its clock halfway through that trip.
let offset = 0
let synced = 0
let syncing: Promise<void> | null = null

async function sample() {
  const sentAt = performance.now()
  const res = await fetch('/api/time', { cache: 'no-store', credentials: 'omit' })
  const receivedAt = performance.now()
  const { now } = (await res.json()) as { now: number }
  const rtt = receivedAt - sentAt
  // Date.now() at the midpoint of the trip, on this device.
  const localMid = Date.now() - (receivedAt - (sentAt + rtt / 2))
  return { rtt, offset: now - localMid }
}

/** Measures the offset (best of 4 round trips). Re-runs at most once a minute. */
export function syncClock() {
  if (syncing) return syncing
  if (Date.now() - synced < 60_000) return Promise.resolve()
  syncing = (async () => {
    try {
      let best: { rtt: number; offset: number } | null = null
      for (let i = 0; i < 4; i++) {
        const s = await sample()
        if (!best || s.rtt < best.rtt) best = s
      }
      if (best) {
        offset = best.offset
        synced = Date.now()
      }
    } catch {
      /* keep the last offset */
    } finally {
      syncing = null
    }
  })()
  return syncing
}

/** Now, on the server's clock (ms). */
export function serverNow() {
  return Date.now() + offset
}

/** "0.4 s", "1.2 s", "under 0.1 s". */
export function formatDelay(ms: number) {
  if (ms < 100) return 'under 0.1 s'
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}
