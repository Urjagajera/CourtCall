// Usage: npm run db:ping — measures round-trip time to the database (median of 10).
import { sql } from '../db/index.js'

await sql`select 1` // warm up the connection
const times: number[] = []
for (let i = 0; i < 10; i++) {
  const t = performance.now()
  await sql`select 1`
  times.push(performance.now() - t)
}
times.sort((a, b) => a - b)
console.log(`DB round trip: median ${Math.round(times[5])} ms, best ${Math.round(times[0])} ms`)
await sql.end()
