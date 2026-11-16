// Keeps this device's clock in step with the CourtCall server, from the X-Server-Time header on every API
// reply. Phones are often a second or more off; without this, delivery times would be wrong.
let offset = 0
let bestRtt = Infinity
let samples = 0

/** Called by api() for every reply: keeps the sample with the shortest round trip (the most accurate). */
export function noteServerTime(header: string | null, sentAt: number, receivedAt: number) {
  const server = Number(header)
  if (!header || !Number.isFinite(server)) return
  const rtt = receivedAt - sentAt
  samples++
  // A fresh low-latency sample always wins; old ones age out slowly so a changed clock is picked up.
  if (rtt <= bestRtt || samples % 20 === 0) {
    bestRtt = rtt
    offset = server - (sentAt + rtt / 2)
  }
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
