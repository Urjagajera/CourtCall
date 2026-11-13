import { and, eq, gte, inArray, isNotNull, isNull, ne, not, like, sql } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireFirmAdmin, requireVerified } from '../lib/auth.js'
import { requireClient } from '../lib/clientAccess.js'
import { forbidden, parse } from '../lib/http.js'

// Usage that runs on Nexconn (calls, voice notes) is reported by the app, and the firm admin sees a weekly summary.
export const usageRouter = Router()

const usageInput = z.object({ kind: z.enum(['call', 'voice_note']), seconds: z.number().int().min(0).max(7200).default(0) })

/** Staff: a call they placed ended, or they sent a voice note. */
usageRouter.post('/usage', requireAuth, requireVerified, async (req, res) => {
  const user = req.user!
  if (!user.officeId) throw forbidden('You are not part of a firm')
  const body = parse(usageInput, req.body)
  await db.insert(schema.usageEvents).values({ officeId: user.officeId, userId: user.id, kind: body.kind, seconds: body.seconds })
  res.status(201).json({ ok: true })
})

/** Client (link): a call they placed ended, or they sent a voice note. */
usageRouter.post('/c/usage', requireClient, async (req, res) => {
  const ctx = req.clientCtx!
  const body = parse(usageInput, req.body)
  await db.insert(schema.usageEvents).values({ officeId: ctx.office.id, clientId: ctx.client.id, kind: body.kind, seconds: body.seconds })
  res.status(201).json({ ok: true })
})

const DAY = 24 * 60 * 60 * 1000

/** Firm admin: what the firm did in CourtCall in the last 7 days, and in total. */
usageRouter.get('/office/usage', requireAuth, requireVerified, requireFirmAdmin, async (req, res) => {
  const officeId = req.user!.officeId!
  const since = new Date(Date.now() - 7 * DAY)
  // Raw SQL parameters must be strings (postgres.js does not serialise a Date inside sql``).
  const sinceIso = since.toISOString()
  const pair = (cond: ReturnType<typeof sql>) => ({
    week: sql<number>`count(*) filter (where ${cond})`.mapWith(Number),
    total: sql<number>`count(*)`.mapWith(Number),
  })
  const firmCases = db.select({ id: schema.cases.id }).from(schema.cases).where(eq(schema.cases.officeId, officeId))

  const [updates, alerts, briefings, outcomes, usage, links] = await Promise.all([
    // Courtroom updates reported by this firm's people (undo entries left out).
    db
      .select(pair(sql`${schema.courtEvents.createdAt} >= ${sinceIso}`))
      .from(schema.courtEvents)
      .where(and(eq(schema.courtEvents.officeId, officeId), ne(schema.courtEvents.type, 'correction'))),
    // Client alerts actually sent (silent bookkeeping rows have no message; firm and briefing keys excluded).
    db
      .select(pair(sql`${schema.alertLogs.createdAt} >= ${sinceIso}`))
      .from(schema.alertLogs)
      .where(
        and(
          inArray(schema.alertLogs.caseId, firmCases),
          ne(schema.alertLogs.message, ''),
          ne(schema.alertLogs.alertKey, 'briefing'),
          not(like(schema.alertLogs.alertKey, 'staff_%')),
        ),
      ),
    db
      .select(pair(sql`${schema.alertLogs.createdAt} >= ${sinceIso}`))
      .from(schema.alertLogs)
      .where(and(inArray(schema.alertLogs.caseId, firmCases), eq(schema.alertLogs.alertKey, 'briefing'))),
    db
      .select(pair(sql`${schema.caseHearings.createdAt} >= ${sinceIso}`))
      .from(schema.caseHearings)
      .where(inArray(schema.caseHearings.caseId, firmCases)),
    db
      .select({
        kind: schema.usageEvents.kind,
        week: sql<number>`count(*) filter (where ${schema.usageEvents.createdAt} >= ${sinceIso})`.mapWith(Number),
        total: sql<number>`count(*)`.mapWith(Number),
        weekSeconds: sql<number>`coalesce(sum(${schema.usageEvents.seconds}) filter (where ${schema.usageEvents.createdAt} >= ${sinceIso}), 0)`.mapWith(Number),
      })
      .from(schema.usageEvents)
      .where(eq(schema.usageEvents.officeId, officeId))
      .groupBy(schema.usageEvents.kind),
    // Clients who have their link open on a phone right now.
    db
      .select({ n: sql<number>`count(distinct ${schema.cases.clientId})`.mapWith(Number) })
      .from(schema.accessLinks)
      .innerJoin(schema.cases, eq(schema.cases.id, schema.accessLinks.caseId))
      .where(and(eq(schema.cases.officeId, officeId), isNotNull(schema.accessLinks.activatedAt), isNull(schema.accessLinks.revokedAt))),
  ])
  const u = (k: 'call' | 'voice_note' | 'firm_alert') => usage.find((x) => x.kind === k) ?? { week: 0, total: 0, weekSeconds: 0 }
  res.json({
    since: since.toISOString(),
    updates: updates[0],
    clientAlerts: alerts[0],
    firmAlerts: { week: u('firm_alert').week, total: u('firm_alert').total },
    briefings: briefings[0],
    outcomes: outcomes[0],
    calls: { week: u('call').week, total: u('call').total, weekMinutes: Math.round(u('call').weekSeconds / 60) },
    voiceNotes: { week: u('voice_note').week, total: u('voice_note').total },
    clientsConnected: links[0]?.n ?? 0,
  })
})
