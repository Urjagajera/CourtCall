import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export interface OfficeSettings {
  staleMinutes: number
  phoneCountryCode: string
}
export const DEFAULT_SETTINGS: OfficeSettings = { staleMinutes: 20, phoneCountryCode: '91' }

// Firm settings are read on every courtroom poll; cache them briefly (every query goes to Tokyo).
const cache = new Map<string, { at: number; value: OfficeSettings }>()
const TTL_MS = 60_000

export async function officeSettings(officeId: string | null | undefined): Promise<OfficeSettings> {
  if (!officeId) return DEFAULT_SETTINGS
  const hit = cache.get(officeId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const [row] = await db
    .select({ staleMinutes: schema.offices.staleMinutes, phoneCountryCode: schema.offices.phoneCountryCode })
    .from(schema.offices)
    .where(eq(schema.offices.id, officeId))
  const value = row ?? DEFAULT_SETTINGS
  cache.set(officeId, { at: Date.now(), value })
  return value
}

export function forgetOfficeSettings(officeId: string) {
  cache.delete(officeId)
}
