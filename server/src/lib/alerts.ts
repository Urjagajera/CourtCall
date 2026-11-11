// After every accepted courtroom update: work out which clients (in ANY firm with a case in that
// courtroom today) need an alert, record it once in alert_logs, and deliver it by Nexconn + Web Push.
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { CourtEvent, CourtSession } from '../db/schema.js'
import { chooseAlert } from './alertRules.js'
import { MSG_ALERT, issueToken, ncClientId, safely, sendBotDirectMessage } from './nexconn.js'
import { pushToLinks } from './push.js'

// Nexconn users must exist before they can receive messages; clients are registered on first alert.
const registered = new Set<string>()

export async function alertClients(session: CourtSession, event: CourtEvent) {
  if (event.type === 'correction') return
  const rows = await db
    .select({
      caseId: schema.cases.id,
      itemNo: schema.cases.itemNo,
      title: schema.cases.title,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      roomNo: schema.courtrooms.roomNo,
    })
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .where(and(eq(schema.cases.courtroomId, session.courtroomId), eq(schema.cases.hearingDate, session.date)))
  if (!rows.length) return

  const caseIds = rows.map((r) => r.caseId)
  const already = await db
    .select({ caseId: schema.alertLogs.caseId, key: schema.alertLogs.alertKey })
    .from(schema.alertLogs)
    .where(and(eq(schema.alertLogs.sessionId, session.id), inArray(schema.alertLogs.caseId, caseIds)))
  const sentFor = (id: string) => new Set(already.filter((a) => a.caseId === id).map((a) => a.key))

  const picks = rows
    .map((r) => ({
      r,
      pick: chooseAlert({
        event: { type: event.type, item: event.item, version: event.version },
        currentItem: session.currentItem,
        caseItem: r.itemNo,
        roomNo: r.roomNo,
        sent: sentFor(r.caseId),
      }),
    }))
    .filter((p): p is typeof p & { pick: NonNullable<typeof p.pick> } => p.pick !== null)
  if (!picks.length) return

  // Record first; the unique (case, session, key) index means a racing duplicate is simply skipped.
  // Implied keys are stored with an empty message so they never show on the client page.
  const inserted = await db
    .insert(schema.alertLogs)
    .values(
      picks.flatMap(({ r, pick }) => [
        { caseId: r.caseId, sessionId: session.id, eventVersion: event.version, alertKey: pick.key, message: pick.message },
        ...pick.implied.map((k) => ({ caseId: r.caseId, sessionId: session.id, eventVersion: event.version, alertKey: k, message: '' })),
      ]),
    )
    .onConflictDoNothing()
    .returning({ caseId: schema.alertLogs.caseId, key: schema.alertLogs.alertKey })
  const fresh = picks.filter(({ r, pick }) => inserted.some((i) => i.caseId === r.caseId && i.key === pick.key))
  if (!fresh.length) return

  // Push goes to phones of active links (client and family) for these cases.
  const links = await db
    .select({ id: schema.accessLinks.id, caseId: schema.accessLinks.caseId })
    .from(schema.accessLinks)
    .where(and(inArray(schema.accessLinks.caseId, fresh.map((f) => f.r.caseId)), isNull(schema.accessLinks.revokedAt)))

  await Promise.all(
    fresh.map(async ({ r, pick }) => {
      const ncId = ncClientId(r.clientId)
      await safely('client alert', async () => {
        if (!registered.has(ncId)) {
          await issueToken(ncId, r.clientName)
          registered.add(ncId)
        }
        await sendBotDirectMessage([ncId], MSG_ALERT, { text: pick.message, caseId: r.caseId, key: pick.key }, pick.message)
      })
      await pushToLinks(
        links.filter((l) => l.caseId === r.caseId).map((l) => l.id),
        { title: `CourtCall · ${r.title}`, body: pick.message, url: '/case', tag: `case-${r.caseId}` },
      ).catch((e) => console.warn('[push]', e instanceof Error ? e.message : e))
    }),
  )
}
