import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { Router, type Request } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { upsertCourtroom } from '../lib/courtrooms.js'
import { courtDate } from '../lib/engine.js'
import { HttpError, badRequest, forbidden, notFound, parse } from '../lib/http.js'
import { todaysBriefing } from '../lib/briefing.js'
import { notify } from '../lib/notify.js'
import { canEditCase, canManageTeam, caseVisible, clientScope, firmAdminIds, inScope, teamOf } from '../lib/visibility.js'

// Hearing outcomes, the reminder list, the calendar, and the client / case detail pages.
// Everything follows lib/visibility: firm admins see everything, others only the cases they are on.
export const hearingsRouter = Router()
const anyStaff = [requireAuth, requireVerified, requireRole('lawyer', 'junior', 'staff')] as const

const caseCols = {
  id: schema.cases.id,
  title: schema.cases.title,
  caseNo: schema.cases.caseNo,
  hearingDate: schema.cases.hearingDate,
  itemNo: schema.cases.itemNo,
  status: schema.cases.status,
  clientId: schema.cases.clientId,
  clientName: schema.clients.name,
  clientPhone: schema.clients.phone,
  courtComplex: schema.courtrooms.courtComplex,
  roomNo: schema.courtrooms.roomNo,
  courtroomId: schema.cases.courtroomId,
  assignedJuniorId: schema.cases.assignedJuniorId,
  mainLawyerId: schema.cases.mainLawyerId,
  helperStaffId: schema.cases.helperStaffId,
  appearingLawyerId: schema.cases.appearingLawyerId,
  rememberNote: schema.cases.rememberNote,
  officeId: schema.cases.officeId,
}

async function caseInScope(req: Request, id: string) {
  const [c] = await db
    .select(caseCols)
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .where(and(eq(schema.cases.id, parse(z.uuid(), id)), eq(schema.cases.officeId, req.user!.officeId!), caseVisible(req.user!)))
  if (!c) throw notFound('Case not found')
  return c
}

async function hearingsOf(caseIds: string[]) {
  if (!caseIds.length) return []
  return db
    .select({
      id: schema.caseHearings.id,
      caseId: schema.caseHearings.caseId,
      date: schema.caseHearings.date,
      itemNo: schema.caseHearings.itemNo,
      outcome: schema.caseHearings.outcome,
      nextDate: schema.caseHearings.nextDate,
      summary: schema.caseHearings.summary,
      shareWithClient: schema.caseHearings.shareWithClient,
      prepNotes: schema.caseHearings.prepNotes,
      courtComplex: schema.courtrooms.courtComplex,
      roomNo: schema.courtrooms.roomNo,
      recordedByName: schema.users.name,
      createdAt: schema.caseHearings.createdAt,
    })
    .from(schema.caseHearings)
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.caseHearings.courtroomId))
    .leftJoin(schema.users, eq(schema.users.id, schema.caseHearings.recordedBy))
    .where(inArray(schema.caseHearings.caseId, caseIds))
    .orderBy(desc(schema.caseHearings.date))
}

/**
 * Hearings that have happened but whose outcome isn't recorded yet: the lawyer's reminder.
 * "Happened" = the date has passed, or today and the court has risen / isn't sitting / has moved past the item.
 * The to-do goes to the case's main lawyer (senior or junior) and to firm admins.
 */
export async function pendingOutcomes(req: Request) {
  const today = courtDate()
  const u = req.user!
  const rows = await db
    .select({ ...caseCols, sessionStatus: schema.courtSessions.status, currentItem: schema.courtSessions.currentItem })
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .leftJoin(
      schema.courtSessions,
      and(eq(schema.courtSessions.courtroomId, schema.cases.courtroomId), eq(schema.courtSessions.date, schema.cases.hearingDate)),
    )
    .where(
      and(
        eq(schema.cases.officeId, req.user!.officeId!),
        eq(schema.cases.status, 'active'),
        lte(schema.cases.hearingDate, today),
        u.isFirmAdmin ? undefined : eq(schema.cases.mainLawyerId, u.id),
      ),
    )
    .orderBy(asc(schema.cases.hearingDate))
  return rows
    .filter(
      (r) =>
        r.hearingDate < today ||
        r.sessionStatus === 'risen' ||
        r.sessionStatus === 'not_sitting' ||
        (r.currentItem != null && r.itemNo != null && r.currentItem > r.itemNo),
    )
    .map(({ sessionStatus: _s, currentItem: _c, ...r }) => r)
}

hearingsRouter.get('/hearings/pending', ...anyStaff, async (req, res) => {
  res.json({ cases: await pendingOutcomes(req) })
})

const outcomeInput = z
  .object({
    outcome: z.enum(['next_date', 'closed']),
    nextDate: z.iso.date().optional(),
    itemNo: z.coerce.number().int().min(1).max(2000).nullable().optional(),
    courtComplex: z.string().trim().min(2).max(100).optional(),
    roomNo: z.string().trim().min(1).max(20).optional(),
    summary: z.string().trim().max(1000).optional(),
    shareWithClient: z.boolean().default(false),
    prepNotes: z.string().trim().max(2000).optional(),
    // For the next hearing's 9 AM briefing to the client.
    appearingLawyerId: z.uuid().nullable().optional(),
    rememberNote: z.string().trim().max(400).optional(),
  })
  .refine((b) => b.outcome === 'closed' || !!b.nextDate, { path: ['nextDate'], message: 'Choose the next hearing date' })

/** Record what happened at the case's current hearing, then move it to the next date or close it. */
hearingsRouter.post('/cases/:id/outcome', ...anyStaff, async (req, res) => {
  const body = parse(outcomeInput, req.body)
  const c = await caseInScope(req, String(req.params.id))
  if (!canEditCase(req.user!, c)) throw forbidden('Only the main lawyer or a firm admin can record this hearing')
  if (c.status === 'closed') throw badRequest('This case is already closed')
  if (c.hearingDate > courtDate()) throw badRequest('This hearing has not happened yet')
  if (body.outcome === 'next_date' && body.nextDate! <= c.hearingDate) throw badRequest('The next date must be after this hearing', { nextDate: ['The next date must be after this hearing'] })
  if ((body.courtComplex && !body.roomNo) || (!body.courtComplex && body.roomNo)) throw badRequest('Send both court and room to change the courtroom')

  if (body.appearingLawyerId) {
    const [u] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, body.appearingLawyerId), eq(schema.users.officeId, c.officeId), eq(schema.users.role, 'lawyer'), eq(schema.users.verificationStatus, 'verified')))
    if (!u) throw badRequest('The appearing lawyer must be an approved senior lawyer of your firm')
  }
  const nextRoom = body.courtComplex && body.roomNo ? await upsertCourtroom(body.courtComplex, body.roomNo) : null
  const result = await db.transaction(async (tx) => {
    const [hearing] = await tx
      .insert(schema.caseHearings)
      .values({
        caseId: c.id,
        date: c.hearingDate,
        courtroomId: c.courtroomId,
        itemNo: c.itemNo,
        outcome: body.outcome,
        nextDate: body.outcome === 'next_date' ? body.nextDate : null,
        summary: body.summary || null,
        shareWithClient: body.shareWithClient && !!body.summary,
        prepNotes: body.prepNotes || null,
        recordedBy: req.user!.id,
      })
      .onConflictDoNothing()
      .returning()
    if (!hearing) throw new HttpError(409, 'The outcome of this hearing is already recorded')
    const [updated] = await tx
      .update(schema.cases)
      .set(
        body.outcome === 'closed'
          ? { status: 'closed' }
          : {
              hearingDate: body.nextDate!,
              itemNo: body.itemNo ?? null,
              ...(nextRoom ? { courtroomId: nextRoom.id } : {}),
              ...(body.appearingLawyerId !== undefined ? { appearingLawyerId: body.appearingLawyerId } : {}),
              rememberNote: body.rememberNote || null,
            },
      )
      .where(eq(schema.cases.id, c.id))
      .returning()
    return { hearing, case: updated }
  })
  // The to-do disappears for everyone; the others on the case and the firm admins get a notice.
  const what = body.outcome === 'closed' ? 'the case ended' : `next date ${body.nextDate}`
  await notify([...teamOf(c), ...(await firmAdminIds(c.officeId))], {
    caseId: c.id,
    kind: 'outcome_recorded',
    message: `${req.user!.name} recorded the hearing of "${c.title}": ${what}`,
    actorId: req.user!.id,
  })
  res.status(201).json(result)
})

/** Edit notes of a recorded hearing (summary, sharing, prep notes). */
hearingsRouter.patch('/hearings/:id', ...anyStaff, async (req, res) => {
  const body = parse(
    z.object({ summary: z.string().trim().max(1000).optional(), shareWithClient: z.boolean().optional(), prepNotes: z.string().trim().max(2000).optional() }),
    req.body,
  )
  const [h] = await db.select().from(schema.caseHearings).where(eq(schema.caseHearings.id, parse(z.uuid(), String(req.params.id))))
  if (!h) throw notFound('Hearing not found')
  const c = await caseInScope(req, h.caseId)
  if (!canEditCase(req.user!, c)) throw forbidden('Only the main lawyer or a firm admin can change these notes')
  const summary = body.summary ?? h.summary
  const [updated] = await db
    .update(schema.caseHearings)
    .set({
      summary: summary || null,
      shareWithClient: (body.shareWithClient ?? h.shareWithClient) && !!summary,
      prepNotes: body.prepNotes ?? h.prepNotes,
    })
    .where(eq(schema.caseHearings.id, h.id))
    .returning()
  await notify([...teamOf(c), ...(await firmAdminIds(c.officeId))], {
    caseId: c.id,
    kind: 'notes_edited',
    message: `${req.user!.name} edited the notes of the ${h.date} hearing of "${c.title}"`,
    actorId: req.user!.id,
  })
  res.json({ hearing: updated })
})

/** Everything about one case: details, case team, hearing history, links, and what this person may change. */
hearingsRouter.get('/cases/:id/detail', ...anyStaff, async (req, res) => {
  const c = await caseInScope(req, String(req.params.id))
  const ids = [...teamOf(c), ...(c.appearingLawyerId ? [c.appearingLawyerId] : [])]
  const [hearings, people, links, briefing] = await Promise.all([
    hearingsOf([c.id]),
    ids.length
      ? db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role }).from(schema.users).where(inArray(schema.users.id, ids))
      : Promise.resolve([]),
    db
      .select({ kind: schema.accessLinks.kind, activatedAt: schema.accessLinks.activatedAt, revokedAt: schema.accessLinks.revokedAt })
      .from(schema.accessLinks)
      .where(eq(schema.accessLinks.caseId, c.id)),
    todaysBriefing(c.id),
  ])
  const pending = (await pendingOutcomes(req)).some((p) => p.id === c.id)
  const who = (id: string | null) => people.find((p) => p.id === id) ?? null
  res.json({
    case: c,
    hearings,
    team: { mainLawyer: who(c.mainLawyerId), helpingJunior: who(c.assignedJuniorId), staffHelper: who(c.helperStaffId) },
    appearingLawyer: who(c.appearingLawyerId),
    briefing,
    permissions: { canEdit: canEditCase(req.user!, c), canManageTeam: canManageTeam(req.user!, c), canChangeMainLawyer: req.user!.isFirmAdmin },
    links: { active: links.filter((l) => !l.revokedAt).length, openedOnPhone: links.some((l) => !l.revokedAt && l.activatedAt) },
    needsOutcome: pending,
  })
})

/** One client: details and every case of theirs this person is on (firm admins: all), with hearings and teams. */
hearingsRouter.get('/clients/:id/detail', ...anyStaff, async (req, res) => {
  const id = parse(z.uuid(), String(req.params.id))
  const scope = await clientScope(req.user!)
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, id), eq(schema.clients.officeId, req.user!.officeId!), inScope(schema.clients.id, scope)))
  if (!client) throw notFound('Client not found')
  const cases = await db
    .select(caseCols)
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .where(and(eq(schema.cases.clientId, id), caseVisible(req.user!)))
    .orderBy(asc(schema.cases.status), desc(schema.cases.hearingDate))
  const ids = [...new Set(cases.flatMap(teamOf))]
  const [hearings, people] = await Promise.all([
    hearingsOf(cases.map((c) => c.id)),
    ids.length ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids)) : Promise.resolve([]),
  ])
  const name = (uid: string | null) => people.find((p) => p.id === uid)?.name ?? null
  res.json({
    client,
    cases: cases.map((c) => ({
      ...c,
      mainLawyerName: name(c.mainLawyerId),
      helpingJuniorName: name(c.assignedJuniorId),
      staffHelperName: name(c.helperStaffId),
      hearings: hearings.filter((h) => h.caseId === c.id),
    })),
  })
})

/** Calendar: upcoming hearings (active cases) and past hearings (recorded outcomes) between two dates. */
hearingsRouter.get('/calendar', ...anyStaff, async (req, res) => {
  const q = parse(z.object({ from: z.iso.date(), to: z.iso.date() }), req.query)
  if (q.to < q.from) throw badRequest('"to" must be after "from"')
  const office = eq(schema.cases.officeId, req.user!.officeId!)
  const [upcoming, past] = await Promise.all([
    db
      .select(caseCols)
      .from(schema.cases)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
      .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
      .where(and(office, eq(schema.cases.status, 'active'), gte(schema.cases.hearingDate, q.from), lte(schema.cases.hearingDate, q.to), caseVisible(req.user!)))
      .orderBy(asc(schema.cases.hearingDate)),
    db
      .select({
        caseId: schema.cases.id,
        title: schema.cases.title,
        caseNo: schema.cases.caseNo,
        clientName: schema.clients.name,
        date: schema.caseHearings.date,
        itemNo: schema.caseHearings.itemNo,
        outcome: schema.caseHearings.outcome,
        nextDate: schema.caseHearings.nextDate,
        courtComplex: schema.courtrooms.courtComplex,
        roomNo: schema.courtrooms.roomNo,
      })
      .from(schema.caseHearings)
      .innerJoin(schema.cases, eq(schema.cases.id, schema.caseHearings.caseId))
      .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
      .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.caseHearings.courtroomId))
      .where(and(office, gte(schema.caseHearings.date, q.from), lte(schema.caseHearings.date, q.to), caseVisible(req.user!)))
      .orderBy(asc(schema.caseHearings.date)),
  ])
  const today = courtDate()
  res.json({
    today,
    events: [
      ...past.map((p) => ({ kind: 'held' as const, ...p })),
      ...upcoming.map((u) => ({
        kind: (u.hearingDate < today ? 'needs_outcome' : 'upcoming') as 'needs_outcome' | 'upcoming',
        caseId: u.id,
        title: u.title,
        caseNo: u.caseNo,
        clientName: u.clientName,
        date: u.hearingDate,
        itemNo: u.itemNo,
        outcome: null,
        nextDate: null,
        courtComplex: u.courtComplex,
        roomNo: u.roomNo,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date)),
  })
})

