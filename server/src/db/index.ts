import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.js'
import * as schema from './schema.js'

// Supabase's pooler (port 6543, transaction mode) does not support prepared statements.
export const sql = postgres(config.databaseUrl, { prepare: false, max: 5 })
export const db = drizzle(sql, { schema })
export { schema }
