import type { Lang } from './alertText.js'
// After every accepted courtroom update: work out who needs an alert, record it once in alert_logs, and deliver it.
// - Clients (in ANY firm with a case in that courtroom today): Nexconn bot message (CC:Alert) + Web Push.
// - The firm (case team + firm admins): Nexconn bot message (CC:StaffAlert, shown as a pop-up in the app) + Web Push,
//   when the client's case is 2 away, being heard, and over. Firm keys (staff_*) are stored with an empty message,
//   so clients never see them.
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { CourtEvent, CourtSession } from '../db/schema.js'
import { chooseAlert, chooseStaffAlert, staffRecipients } from './alertRules.js'
import { MSG_ALERT, MSG_STAFF_ALERT, issueToken, ncClientId, ncStaffId, safely, sendBotDirectMessage } from './nexconn.js'
import { pushToLinks, pushToUsers } from './push.js'

// Nexconn users must exist before they can receive messages; people are registered on their first alert.
const registered = new Set<string>()
export async function ensureNexconnUser(ncId: string, name: string) {
  if (registered.has(ncId)) return
  await issueToken(ncId, name)
  registered.add(ncId)
}

export async function sendAlerts(session: CourtSession, event: CourtEvent) {
  if (event.type === 'correction') return
  const rows = await db
    .select({
      caseId: schema.cases.id,
      itemNo: schema.cases.itemNo,
      title: schema.cases.title,
      officeId: schema.cases.officeId,
      mainLawyerId: schema.cases.mainLawyerId,
      assignedJuniorId: schema.cases.assignedJuniorId,
      helperStaffId: schema.cases.helperStaffId,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      language: schema.clients.language,
      roomNo: schema.courtrooms.roomNo,
    })
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    // Closed cases and cases without an item number yet get no progress alerts.
    .where(
      and(
        eq(schema.cases.courtroomId, session.courtroomId),
        eq(schema.cases.hearingDate, session.date),
        eq(schema.cases.status, 'active'),
        isNotNull(schema.cases.itemNo),
      ),
    )
    .then((list) => list.map((r) => ({ ...r, itemNo: r.itemNo! })))
  if (!rows.length) return

  const caseIds = rows.map((r) => r.caseId)
  const already = await db
    .select({ caseId: schema.alertLogs.caseId, key: schema.alertLogs.alertKey })
    .from(schema.alertLogs)
    .where(and(eq(schema.alertLogs.sessionId, session.id), inArray(schema.alertLogs.caseId, caseIds)))
  const sentFor = (id: string) => new Set(already.filter((a) => a.caseId === id).map((a) => a.key))
  const ev = { type: event.type, item: event.item, version: event.version }

  const picks = rows
    .map((r) => ({
      r,
      pick: chooseAlert({
        event: ev,
        currentItem: session.currentItem,
        caseItem: r.itemNo,
        roomNo: r.roomNo,
        sent: sentFor(r.caseId),
        lang: (['en', 'hi', 'gu'].includes(r.language) ? r.language : 'en') as Lang,
      }),
    }))
    .filter((p): p is typeof p & { pick: NonNullable<typeof p.pick> } => p.pick !== null)

  const staffPicks = rows
    .map((r) => ({
      r,
      pick: chooseStaffAlert({ event: ev, currentItem: session.currentItem, caseItem: r.itemNo, roomNo: r.roomNo, clientName: r.clientName, sent: sentFor(r.caseId) }),
    }))
    .filter((p): p is typeof p & { pick: NonNullable<typeof p.pick> } => p.pick !== null)
  if (!picks.length && !staffPicks.length) return

  // Record first; the unique (case, session, key) index means a racing duplicate is simply skipped.
  // Implied keys and all firm keys are stored with an empty message so they never show on the client page.
  const row = (caseId: string, alertKey: string, message = '') => ({ caseId, sessionId: session.id, eventVersion: event.version, alertKey, message })
  const inserted = await db
    .insert(schema.alertLogs)
    .values([
      ...picks.flatMap(({ r, pick }) => [row(r.caseId, pick.key, pick.message), ...pick.implied.map((k) => row(r.caseId, k))]),
      ...staffPicks.flatMap(({ r, pick }) => [row(r.caseId, pick.key), ...pick.implied.map((k) => row(r.caseId, k))]),
    ])
    .onConflictDoNothing()
    .returning({ caseId: schema.alertLogs.caseId, key: schema.alertLogs.alertKey })
  const isNew = (caseId: string, key: string) => inserted.some((i) => i.caseId === caseId && i.key === key)
  const fresh = picks.filter(({ r, pick }) => isNew(r.caseId, pick.key))
  const freshStaff = staffPicks.filter(({ r, pick }) => isNew(r.caseId, pick.key))

  await Promise.all([deliverToClients(fresh), deliverToFirm(freshStaff, event.reporterId)])
}

type ClientPick = { r: { caseId: string; clientId: string; clientName: string; title: string }; pick: { key: string; message: string } }

async function deliverToClients(fresh: ClientPick[]) {
  if (!fresh.length) return
  // Push goes to phones of active client links for these cases.
  const links = await db
    .select({ id: schema.accessLinks.id, caseId: schema.accessLinks.caseId })
    .from(schema.accessLinks)
    .where(and(inArray(schema.accessLinks.caseId, fresh.map((f) => f.r.caseId)), isNull(schema.accessLinks.revokedAt)))

  await Promise.all(
    fresh.map(async ({ r, pick }) => {
      const ncId = ncClientId(r.clientId)
      await safely('client alert', async () => {
        await ensureNexconnUser(ncId, r.clientName)
        await sendBotDirectMessage([ncId], MSG_ALERT, { text: pick.message, caseId: r.caseId, key: pick.key }, pick.message)
      })
      await pushToLinks(
        links.filter((l) => l.caseId === r.caseId).map((l) => l.id),
        { title: `CourtCall · ${r.title}`, body: pick.message, url: '/case', tag: `case-${r.caseId}` },
      ).catch((e) => console.warn('[push]', e instanceof Error ? e.message : e))
    }),
  )
}

type StaffPick = {
  r: { caseId: string; title: string; officeId: string; mainLawyerId: string | null; assignedJuniorId: string | null; helperStaffId: string | null }
  pick: { key: string; kind: 'close' | 'now' | 'done'; message: string }
}

async function deliverToFirm(fresh: StaffPick[], reporterId: string) {
  if (!fresh.length) return
  // Firm admins of every firm involved, and the names of everyone who will be messaged (one query each).
  const admins = await db
    .select({ id: schema.users.id, officeId: schema.users.officeId })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.officeId, [...new Set(fresh.map((f) => f.r.officeId))]),
        eq(schema.users.isFirmAdmin, true),
        eq(schema.users.role, 'lawyer'),
        eq(schema.users.verificationStatus, 'verified'),
      ),
    )
  const plan = fresh.map((f) => ({
    ...f,
    to: staffRecipients(
      [f.r.mainLawyerId, f.r.assignedJuniorId, f.r.helperStaffId],
      admins.filter((a) => a.officeId === f.r.officeId).map((a) => a.id),
      reporterId,
      f.pick.kind,
    ),
  }))
  const everyone = [...new Set(plan.flatMap((p) => p.to))]
  if (!everyone.length) return
  const people = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, everyone))
  // One usage row per firm alert sent (Team page "This week in CourtCall"); never blocks delivery.
  const sent = plan.filter((p) => p.to.length)
  if (sent.length) {
    await db
      .insert(schema.usageEvents)
      .values(sent.map((p) => ({ officeId: p.r.officeId, kind: 'firm_alert' as const })))
      .catch((e) => console.warn('[usage]', e instanceof Error ? e.message : e))
  }

  await Promise.all(
    plan.map(async ({ r, pick, to }) => {
      if (!to.length) return
      // "Over" opens the case with the outcome form; the others just open the case.
      const url = `/cases/${r.caseId}${pick.kind === 'done' ? '?update=1' : ''}`
      await safely('firm alert', async () => {
        await Promise.all(to.map((id) => ensureNexconnUser(ncStaffId(id), people.find((p) => p.id === id)?.name ?? 'CourtCall user')))
        await sendBotDirectMessage(to.map(ncStaffId), MSG_STAFF_ALERT, { text: pick.message, caseId: r.caseId, kind: pick.kind, url }, pick.message)
      })
      await pushToUsers(to, { title: `CourtCall · ${r.title}`, body: pick.message, url, tag: `staff-case-${r.caseId}` }).catch((e) =>
        console.warn('[push]', e instanceof Error ? e.message : e),
      )
    }),
  )
}
