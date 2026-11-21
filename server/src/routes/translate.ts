import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { publicUser, requireAuth } from '../lib/auth.js'
import { requireClient } from '../lib/clientAccess.js'
import { parse } from '../lib/http.js'
import { translateNote } from '../lib/translate.js'

// Languages: each person's app language, and on-demand translation of text the firm or a client typed
// (hearing summaries, chat messages) into the reader's language. Free MyMemory service (lib/translate.ts).
export const translateRouter = Router()

const LANG = z.enum(['en', 'hi', 'gu'])
const batch = z.object({ texts: z.array(z.string().max(1000)).min(1).max(20), to: LANG })

async function translateAll(texts: string[], to: 'en' | 'hi' | 'gu') {
  return Promise.all(texts.map(async (t) => (await translateNote(t, to)).text))
}

/** Staff: save the app language picked at first login or in Settings. */
translateRouter.post('/auth/language', requireAuth, async (req, res) => {
  const { language } = parse(z.object({ language: LANG }), req.body)
  const [user] = await db.update(schema.users).set({ language }).where(eq(schema.users.id, req.user!.id)).returning()
  res.json({ user: publicUser(user) })
})

/** Staff: translate a few texts into a language. */
translateRouter.post('/translate', requireAuth, async (req, res) => {
  const { texts, to } = parse(batch, req.body)
  res.json({ texts: await translateAll(texts, to) })
})

/** Client link: translate into the client's language. */
translateRouter.post('/c/translate', requireClient, async (req, res) => {
  const { texts, to } = parse(batch, req.body)
  res.json({ texts: await translateAll(texts, to) })
})
