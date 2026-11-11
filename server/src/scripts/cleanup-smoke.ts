// Usage: npm run smoke:cleanup — removes the isolated smoke-test courtrooms ("Smoke Test Court", any case).
import { inArray, sql as dsql } from 'drizzle-orm'
import { db, schema, sql } from '../db/index.js'

const rooms = await db
  .select({ id: schema.courtrooms.id })
  .from(schema.courtrooms)
  .where(dsql`lower(${schema.courtrooms.courtComplex}) = 'smoke test court'`)
const ids = rooms.map((r) => r.id)
if (ids.length) {
  await db.delete(schema.cases).where(inArray(schema.cases.courtroomId, ids))
  await db.delete(schema.courtSessions).where(inArray(schema.courtSessions.courtroomId, ids)) // cascades members/events/alerts
  await db.delete(schema.courtrooms).where(inArray(schema.courtrooms.id, ids))
}
// Clients created by interrupted smoke runs ("Smoke Client…"); their cases and links go with them.
await db.delete(schema.clients).where(dsql`${schema.clients.name} like 'Smoke Client%'`)
// People who signed up during the smoke test (never own data, so a plain delete is safe).
const people = await db.delete(schema.users).where(dsql`${schema.users.email} like '%@smoke.test'`).returning({ id: schema.users.id })
console.log(`Removed ${ids.length} smoke-test courtroom(s) and ${people.length} smoke-test account(s).`)
await sql.end()
