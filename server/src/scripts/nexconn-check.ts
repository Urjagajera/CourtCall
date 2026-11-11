// Usage: npm run nexconn:check — verifies keys/signature by registering the CourtCall bot user.
import { config } from '../config.js'
import { BOT_ID, issueToken } from '../lib/nexconn.js'

try {
  const token = await issueToken(BOT_ID, 'CourtCall')
  console.log(`OK: Nexconn reachable at ${config.nexconn.apiBase}, bot user "${BOT_ID}" registered (token ${token.length} chars).`)
} catch (e) {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
}
