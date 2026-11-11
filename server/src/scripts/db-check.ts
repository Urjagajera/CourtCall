// Usage: npm run db:check  — prints the tables in the connected database.
import { sql } from '../db/index.js'

const rows = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`
console.log(`${rows.length} tables: ${rows.map((r) => r.table_name).join(', ')}`)
await sql.end()
