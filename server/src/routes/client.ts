import { and, desc, eq, inArray, ne, or } from 'drizzle-orm'
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

/**
 * Everything the client page shows: one case (live), the client's other cases, and day-by-day history.
 * `?case=<id>` opens another case of the SAME client (client links only; family links see one case).
 * Never other clients, other firms, or reporter names.
 */
clientRouter.get('/me', requireClient, async (req, res) => {
  const ctx = req.clientCtx!
  const today = courtDate()

  // Which case to show: the link's own case, or another case of this client.
  let theCase = ctx.case
  let courtroom = ctx.courtroom
  const wanted = typeof req.query.case === 'string' ? req.query.case : null
  if (wanted && wanted !== ctx.case.id) {
    if (ctx.link.kind !== 'client') throw new HttpError(404, 'Case not found')
    const id = parse(z.uuid(), wanted)
    const [row] = await db
      .select({ c: schema.cases, room: schema.courtrooms })
      .from(schema.cases)
      .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
      .where(and(eq(schema.cases.id, id), eq(schema.cases.clientId, ctx.client.id), eq(schema.cases.officeId, ctx.office.id)))
    if (!row) throw new HttpError(404, 'Case not found')
    theCase = row.c
    courtroom = row.room
  }
  const isToday = theCase.hearingDate === today

  let session: ReturnType<typeof sessionView> | null = null
  let updates: { type: string; item: number | null; at: Date }[] = []
  if (isToday) {
    const [s] = await db
      .select()
      .from(schema.courtSessions)
      .where(and(eq(schema.courtSessions.courtroomId, courtroom.id), eq(schema.courtSessions.date, today)))
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

  const [history, cases, hearings] = await Promise.all([
    // Every alert ever sent for this case, with the court day it belongs to (newest first).
    db
      .select({ date: schema.courtSessions.date, message: schema.alertLogs.message, at: schema.alertLogs.createdAt })
      .from(schema.alertLogs)
      .innerJoin(schema.courtSessions, eq(schema.courtSessions.id, schema.alertLogs.sessionId))
      // Empty messages are silent bookkeeping (skipped thresholds), never shown.
      .where(and(eq(schema.alertLogs.caseId, theCase.id), ne(schema.alertLogs.message, '')))
      .orderBy(desc(schema.alertLogs.createdAt))
      .limit(80),
    // The client's cases with this firm (family links: only the shared case).
    ctx.link.kind === 'client'
      ? db
          .select({
            id: schema.cases.id,
            title: schema.cases.title,
            caseNo: schema.cases.caseNo,
            hearingDate: schema.cases.hearingDate,
            itemNo: schema.cases.itemNo,
            status: schema.cases.status,
            courtComplex: schema.courtrooms.courtComplex,
            roomNo: schema.courtrooms.roomNo,
          })
          .from(schema.cases)
          .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
          .where(and(eq(schema.cases.clientId, ctx.client.id), eq(schema.cases.officeId, ctx.office.id)))
          .orderBy(desc(schema.cases.hearingDate))
      : Promise.resolve([]),
    // Recorded hearing outcomes. The summary only if the lawyer chose to share it; prep notes never.
    db
      .select({
        date: schema.caseHearings.date,
        outcome: schema.caseHearings.outcome,
        nextDate: schema.caseHearings.nextDate,
        summary: schema.caseHearings.summary,
        shareWithClient: schema.caseHearings.shareWithClient,
      })
      .from(schema.caseHearings)
      .where(eq(schema.caseHearings.caseId, theCase.id))
      .orderBy(desc(schema.caseHearings.date)),
  ])

  res.json({
    kind: ctx.link.kind,
    clientName: ctx.client.name,
    language: ctx.client.language,
    firmName: ctx.office.name,
    linkId: ctx.link.id,
    caseId: theCase.id,
    case: {
      title: theCase.title,
      caseNo: theCase.caseNo,
      itemNo: theCase.itemNo,
      hearingDate: theCase.hearingDate,
      status: theCase.status,
      courtComplex: courtroom.courtComplex,
      roomNo: courtroom.roomNo,
    },
    isToday,
    today,
    session,
    updates,
    alerts: history.filter((h) => h.date === today).map(({ message, at }) => ({ message, at })),
    history,
    hearings: hearings.map(({ shareWithClient, summary, ...h }) => ({ ...h, summary: shareWithClient ? summary : null })),
    cases: cases.map((c) => ({ ...c, current: c.id === theCase.id })),
  })
})

/** The client picks their language on their page: it also changes the language of their alerts. */
clientRouter.post('/language', requireClient, async (req, res) => {
  const { language } = parse(z.object({ language: z.enum(['en', 'hi', 'gu']) }), req.body)
  const ctx = req.clientCtx!
  // A family link only changes what that phone shows, not the client's alerts.
  if (ctx.link.kind === 'client') await db.update(schema.clients).set({ language }).where(eq(schema.clients.id, ctx.client.id))
  res.json({ ok: true })
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
        // Only the people who look after this client, plus the firm admins.
        or(
          eq(schema.users.isFirmAdmin, true),
          inArray(
            schema.users.id,
            db.select({ id: schema.clientAssignments.userId }).from(schema.clientAssignments).where(eq(schema.clientAssignments.clientId, ctx.client.id)),
          ),
        ),
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
