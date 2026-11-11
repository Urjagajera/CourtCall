import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Tidy spacing so "Court  4 " and "court 4" compare equal. Matching ignores case (see findCourtroom). */
export function normaliseRoom(courtComplex: string, roomNo: string) {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ')
  return { courtComplex: clean(courtComplex), roomNo: clean(roomNo).toUpperCase() }
}

async function findCourtroom(courtComplex: string, roomNo: string) {
  const [room] = await db
    .select()
    .from(schema.courtrooms)
    .where(and(sql`lower(${schema.courtrooms.courtComplex}) = lower(${courtComplex})`, eq(schema.courtrooms.roomNo, roomNo)))
  return room
}

/**
 * Finds or creates the shared courtroom row. Case-insensitive, so offices typing
 * "Gujarat High Court" and "gujarat high court" end up in the same room.
 * The first spelling used becomes the display name.
 */
export async function upsertCourtroom(courtComplex: string, roomNo: string) {
  const key = normaliseRoom(courtComplex, roomNo)
  const existing = await findCourtroom(key.courtComplex, key.roomNo)
  if (existing) return existing
  await db.insert(schema.courtrooms).values(key).onConflictDoNothing()
  return (await findCourtroom(key.courtComplex, key.roomNo))!
}
