import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { HttpError, parse } from '../lib/http.js'
import { pushEnabled } from '../lib/push.js'

// Phone / browser alerts for lawyers, juniors and staff (Settings → Phone alerts): their client's case is
// 2 away, being heard, or over. One subscription per browser; it belongs to whoever turned it on last.
export const pushRouter = Router()
pushRouter.use(requireAuth, requireVerified, requireRole('lawyer', 'junior', 'staff'))

const subscription = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
})

pushRouter.get('/key', (_req, res) => {
  if (!pushEnabled) throw new HttpError(503, 'Phone alerts are not set up on this server')
  res.json({ publicKey: config.webPush.publicKey })
})

/** Is this browser's subscription registered to me? (It may belong to someone else who used this browser.) */
pushRouter.post('/status', async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.url().max(1000) }), req.body)
  const [s] = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.userId, req.user!.id)))
  res.json({ on: Boolean(s) })
})

pushRouter.post('/', async (req, res) => {
  if (!pushEnabled) throw new HttpError(503, 'Phone alerts are not set up on this server')
  const sub = parse(subscription, req.body)
  const userId = req.user!.id
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, keys: sub.keys })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId, keys: sub.keys, accessLinkId: null } })
  res.status(201).json({ ok: true })
})

pushRouter.post('/off', async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.url().max(1000) }), req.body)
  await db
    .delete(schema.pushSubscriptions)
    .where(and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.userId, req.user!.id)))
  res.json({ ok: true })
})
