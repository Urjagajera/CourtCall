import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.js'
import * as schema from './schema.js'

// Supabase's pooler (port 6543, transaction mode) does not support prepared statements.
// max_pipeline: 1 = one query per connection at a time. With pipelining (postgres.js default 100), a page that fires
// more queries than there are connections makes Supabase's transaction pooler stall: every request hangs until the
// API restarts (seen 12–13 Nov 2026, see CLAUDE.md "Gotchas"). Extra queries now wait for a free connection instead.
export const sql = postgres(config.databaseUrl, { prepare: false, max: Number(process.env.DB_POOL_MAX ?? 5), max_pipeline: 1 })
export const db = drizzle(sql, { schema })
export { schema }
