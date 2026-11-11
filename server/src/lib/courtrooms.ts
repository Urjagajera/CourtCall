import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Normalise so "court 4", "Court 4 " and "COURT 4" share one room across offices. */
export function normaliseRoom(courtComplex: string, roomNo: string) {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ')
  return { courtComplex: clean(courtComplex), roomNo: clean(roomNo).toUpperCase() }
}

/** Finds or creates the shared courtroom row. */
export async function upsertCourtroom(courtComplex: string, roomNo: string) {
  const key = normaliseRoom(courtComplex, roomNo)
  await db.insert(schema.courtrooms).values(key).onConflictDoNothing()
  const [room] = await db
    .select()
    .from(schema.courtrooms)
    .where(and(eq(schema.courtrooms.courtComplex, key.courtComplex), eq(schema.courtrooms.roomNo, key.roomNo)))
  return room
}
