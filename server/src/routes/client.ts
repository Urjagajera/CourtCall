import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { config, nexconnEnabled } from '../config.js'
import { db, schema } from '../db/index.js'
import {
  DEMO_CLIENT_TOKEN,
  DEMO_LINK_LABEL,
  clearClientCookie,
  requireClient,
  setClientCookie,
  sha256,
} from '../lib/clientAccess.js'
import { courtDate } from '../lib/engine.js'
import { HttpError, parse } from '../lib/http.js'
import { issueToken, ncClientId, ncStaffId } from '../lib/nexconn.js'
import { pushEnabled } from '../lib/push.js'
import { recentEvents, sessionView } from '../lib/sessions.js'

// The client's side: open a WhatsApp-shared link, see their own case, chat with the firm.
export const clientRouter = Router()

/** First open binds the link to this phone. The same phone can always reopen it; other phones can't. */
clientRouter.post('/activate', async (req, res) => {
  const { token, deviceId } = parse(
    z.object({ token: z.string().min(10).max(200), deviceId: z.string().min(16).max(100) }),
    req.body,
  )
  const [link] = await db.select().from(schema.accessLinks).where(eq(schema.accessLinks.tokenHash, sha256(token)))
  if (!link) throw new HttpError(404, 'This link is not valid. Check that you opened the full link from WhatsApp.')
  if (link.revokedAt) throw new HttpError(410, 'This link was turned off. Ask your lawyer for a new one.')
  const device = sha256(deviceId)
  if (link.deviceIdHash && link.deviceIdHash !== device) {
    throw new HttpError(409, 'This link is already in use on another phone. Ask your lawyer for a new link.')
  }
  if (!link.deviceIdHash && link.label !== DEMO_LINK_LABEL) {
    await db
      .update(schema.accessLinks)
      .set({ deviceIdHash: device, activatedAt: new Date() })
      .where(eq(schema.accessLinks.id, link.id))
  }
  setClientCookie(res, link.id)
  res.json({ ok: true })
})

/** One-tap client demo (DEMO_LOGIN=true only): opens Ramesh Patel's seeded case without binding a phone. */
clientRouter.post('/demo', async (_req, res) => {
  if (!config.demoLogin) throw new HttpError(404, 'Demo login is turned off')
  const [link] = await db.select().from(schema.accessLinks).where(eq(schema.accessLinks.tokenHash, sha256(DEMO_CLIENT_TOKEN)))
  if (!link) throw new HttpError(404, 'Demo data is missing. Run: npm --prefix server run seed:demo')
  setClientCookie(res, link.id)
  res.json({ ok: true })
})

clientRouter.post('/signout', (_req, res) => {
  clearClientCookie(res)
  res.json({ ok: true })
})

/** Everything the client page shows. Only this case; never other clients, firms or reporter names. */
clientRouter.get('/me', requireClient, async (req, res) => {
  const ctx = req.clientCtx!
  const today = courtDate()
  const isToday = ctx.case.hearingDate === today

  let session: ReturnType<typeof sessionView> | null = null
  let updates: { type: string; item: number | null; at: Date }[] = []
  if (isToday) {
    const [s] = await db
      .select()
      .from(schema.courtSessions)
      .where(and(eq(schema.courtSessions.courtroomId, ctx.courtroom.id), eq(schema.courtSessions.date, today)))
    if (s) {
      session = sessionView(s)
      const events = await recentEvents(s.id, 20)
      // Hide undone updates and the undo entries themselves: clients only see what stands.
      const undone = new Set(events.filter((e) => e.type === 'correction').map((e) => e.correctsEventId))
      updates = events
        .filter((e) => e.type !== 'correction' && !undone.has(e.id))
        .slice(0, 8)
        .map((e) => ({ type: e.type, item: e.item, at: e.createdAt }))
    }
  }

  const alerts = await db
    .select({ message: schema.alertLogs.message, at: schema.alertLogs.createdAt })
    .from(schema.alertLogs)
    // Empty messages are silent bookkeeping (skipped thresholds), never shown.
    .where(and(eq(schema.alertLogs.caseId, ctx.case.id), ne(schema.alertLogs.message, '')))
    .orderBy(desc(schema.alertLogs.createdAt))
    .limit(20)

  res.json({
    kind: ctx.link.kind,
    clientName: ctx.client.name,
    firmName: ctx.office.name,
    case: {
      title: ctx.case.title,
      caseNo: ctx.case.caseNo,
      itemNo: ctx.case.itemNo,
      hearingDate: ctx.case.hearingDate,
      courtComplex: ctx.courtroom.courtComplex,
      roomNo: ctx.courtroom.roomNo,
    },
    isToday,
    session,
    updates,
    alerts,
  })
})

// ---- Phone notifications (Web Push) ----

clientRouter.get('/push-key', (_req, res) => {
  if (!pushEnabled) throw new HttpError(503, 'Phone alerts are not set up on this server')
  res.json({ publicKey: config.webPush.publicKey })
})

const subscription = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
})

clientRouter.post('/push', requireClient, async (req, res) => {
  const sub = parse(subscription, req.body)
  const linkId = req.clientCtx!.link.id
  await db
    .insert(schema.pushSubscriptions)
    .values({ accessLinkId: linkId, endpoint: sub.endpoint, keys: sub.keys })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { accessLinkId: linkId, keys: sub.keys, userId: null } })
  res.status(201).json({ ok: true })
})

clientRouter.post('/push/off', requireClient, async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.url().max(1000) }), req.body)
  await db
    .delete(schema.pushSubscriptions)
    .where(and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.accessLinkId, req.clientCtx!.link.id)))
  res.json({ ok: true })
})

/**
 * Nexconn token for the client's private chat with the firm (client links only, not family links).
 * Contacts: the person who shared the link first, then the firm's other lawyers and staff.
 */
clientRouter.post('/chat-token', requireClient, async (req, res) => {
  const ctx = req.clientCtx!
  if (ctx.link.kind !== 'client') throw new HttpError(403, 'Chat is not available on a family link')
  if (!nexconnEnabled) throw new HttpError(503, 'Chat is not configured on this server')
  const ncId = ncClientId(ctx.client.id)
  const token = await issueToken(ncId, ctx.client.name)
  const people = await db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.officeId, ctx.office.id),
        eq(schema.users.verificationStatus, 'verified'),
        inArray(schema.users.role, ['lawyer', 'staff']),
      ),
    )
  const first = ctx.link.createdBy ?? ctx.office.ownerId
  people.sort((a, b) => Number(b.id === first) - Number(a.id === first))
  res.json({
    appKey: config.nexconn.appKey,
    userId: ncId,
    token,
    team: null,
    contacts: people.map((p) => ({ ncId: ncStaffId(p.id), name: p.name, role: p.role })),
  })
})
