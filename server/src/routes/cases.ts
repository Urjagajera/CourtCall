import { and, asc, eq, getTableColumns } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import type { User } from '../db/schema.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { upsertCourtroom } from '../lib/courtrooms.js'
import { HttpError, badRequest, forbidden, notFound, parse } from '../lib/http.js'
import { sendBriefings, todaysBriefing } from '../lib/briefing.js'
import { courtDate } from '../lib/engine.js'
import { notify } from '../lib/notify.js'
import { canAddCases, canEditCase, canManageTeam, caseVisible, clientScope, inScope, teamOf, validateTeam } from '../lib/visibility.js'

// Cases: a firm's client in a courtroom on a date, with a team (main lawyer, helping junior, staff helper).
// Rules: see lib/visibility.ts and CLAUDE.md "Case teams".
export const casesRouter = Router()
casesRouter.use(requireAuth, requireVerified, requireRole('lawyer', 'junior', 'staff'))

const details = {
  clientId: z.uuid(),
  title: z.string().trim().min(2).max(160),
  caseNo: z.string().trim().max(60).optional(),
  courtComplex: z.string().trim().min(2).max(100),
  roomNo: z.string().trim().min(1).max(20),
  hearingDate: z.iso.date(),
  // Optional: the item number is only known once the cause list for that date is out.
  itemNo: z.coerce.number().int().min(1).max(2000).nullable().optional(),
  // Hearing-day briefing: who appears for the client, and a note read to the client (cleared after the briefing).
  appearingLawyerId: z.uuid().nullable().optional(),
  rememberNote: z.string().trim().max(400).nullable().optional(),
}
const team = {
  mainLawyerId: z.uuid().optional(),
  assignedJuniorId: z.uuid().nullable().optional(),
  helperStaffId: z.uuid().nullable().optional(),
}

async function assertOfficeClient(user: User, clientId: string) {
  const scope = await clientScope(user)
  const [c] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.officeId, user.officeId!), inScope(schema.clients.id, scope)))
  if (!c) throw badRequest('Client not found in your office')
}

/** The appearing lawyer must be an approved senior lawyer of the firm. */
async function assertAppearingLawyer(officeId: string, id: string | null | undefined) {
  if (!id) return
  const [u] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, id), eq(schema.users.officeId, officeId), eq(schema.users.role, 'lawyer'), eq(schema.users.verificationStatus, 'verified')))
  if (!u) throw badRequest('The appearing lawyer must be an approved senior lawyer of your firm', { appearingLawyerId: ['Choose a senior lawyer of your firm'] })
}

/** The case, if this person is on it (firm admins: any case of the firm). */
async function visibleCase(user: User, id: string) {
  const [c] = await db
    .select()
    .from(schema.cases)
    .where(and(eq(schema.cases.id, parse(z.uuid(), id)), eq(schema.cases.officeId, user.officeId!), caseVisible(user)))
  if (!c) throw notFound('Case not found')
  return c
}

const permissions = (u: User, c: { mainLawyerId: string | null; assignedJuniorId: string | null; helperStaffId: string | null }) => ({
  canEdit: canEditCase(u, c),
  canManageTeam: canManageTeam(u, c),
  canChangeMainLawyer: u.isFirmAdmin,
})

casesRouter.get('/', async (req, res) => {
  const date = req.query.date ? parse(z.iso.date(), req.query.date) : undefined
  const rows = await db
    .select({
      ...getTableColumns(schema.cases),
      clientName: schema.clients.name,
      courtComplex: schema.courtrooms.courtComplex,
      roomNo: schema.courtrooms.roomNo,
    })
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .where(and(eq(schema.cases.officeId, req.user!.officeId!), date ? eq(schema.cases.hearingDate, date) : undefined, caseVisible(req.user!)))
    .orderBy(asc(schema.cases.hearingDate), asc(schema.courtrooms.roomNo), asc(schema.cases.itemNo))
  res.json({ cases: rows.map((c) => ({ ...c, ...permissions(req.user!, c) })) })
})

/** New case: firm admins (choose the main lawyer) and senior lawyers (they become the main lawyer). */
casesRouter.post('/', async (req, res) => {
  const user = req.user!
  if (!canAddCases(user)) throw forbidden('Only senior lawyers and firm admins can add cases')
  const body = parse(z.object({ ...details, ...team }), req.body)
  if (body.mainLawyerId && body.mainLawyerId !== user.id && !user.isFirmAdmin) throw forbidden('Only a firm admin can choose another main lawyer')
  await assertOfficeClient(user, body.clientId)
  await assertAppearingLawyer(user.officeId!, body.appearingLawyerId)
  let picked
  try {
    picked = await validateTeam(user.officeId!, {
      mainLawyerId: body.mainLawyerId ?? user.id,
      assignedJuniorId: body.assignedJuniorId ?? null,
      helperStaffId: body.helperStaffId ?? null,
    })
  } catch (e) {
    throw badRequest((e as Error).message)
  }
  const room = await upsertCourtroom(body.courtComplex, body.roomNo)
  const [created] = await db
    .insert(schema.cases)
    .values({
      officeId: user.officeId!,
      clientId: body.clientId,
      title: body.title,
      caseNo: body.caseNo,
      courtroomId: room.id,
      hearingDate: body.hearingDate,
      itemNo: body.itemNo,
      appearingLawyerId: body.appearingLawyerId ?? null,
      rememberNote: body.rememberNote || null,
      ...picked,
    })
    .returning()
  await notify(teamOf(created), { caseId: created.id, kind: 'assigned', message: `${user.name} added you to "${created.title}"`, actorId: user.id })
  res.status(201).json({ case: created })
})

/** Case details (not the team): firm admin or the main lawyer. */
casesRouter.patch('/:id', async (req, res) => {
  const user = req.user!
  const c = await visibleCase(user, String(req.params.id))
  if (!canEditCase(user, c)) throw forbidden('Only the main lawyer or a firm admin can change this case')
  const body = parse(z.object(details).partial(), req.body)
  if (body.clientId) await assertOfficeClient(user, body.clientId)
  await assertAppearingLawyer(user.officeId!, body.appearingLawyerId)
  if (body.rememberNote === '') body.rememberNote = null
  const { courtComplex, roomNo, ...rest } = body
  const update: Partial<typeof schema.cases.$inferInsert> = { ...rest }
  if (courtComplex || roomNo) {
    if (!courtComplex || !roomNo) throw badRequest('Send both courtComplex and roomNo to change the courtroom')
    update.courtroomId = (await upsertCourtroom(courtComplex, roomNo)).id
  }
  const [updated] = await db.update(schema.cases).set(update).where(eq(schema.cases.id, c.id)).returning()
  const changed = [
    body.hearingDate && body.hearingDate !== c.hearingDate && 'date',
    body.itemNo !== undefined && body.itemNo !== c.itemNo && 'item no.',
    update.courtroomId && update.courtroomId !== c.courtroomId && 'court',
    body.caseNo !== undefined && body.caseNo !== c.caseNo && 'case no.',
    body.title && body.title !== c.title && 'title',
    body.appearingLawyerId !== undefined && body.appearingLawyerId !== c.appearingLawyerId && 'appearing lawyer',
  ].filter(Boolean)
  if (changed.length) {
    await notify(teamOf(updated), { caseId: c.id, kind: 'details_changed', message: `${user.name} changed the ${changed.join(', ')} of "${updated.title}"`, actorId: user.id })
  }
  res.json({ case: updated })
})

/**
 * The case team. Firm admin: everything. Senior main lawyer: helping junior and staff helper only.
 * Juniors and staff: nothing.
 */
casesRouter.put('/:id/team', async (req, res) => {
  const user = req.user!
  const c = await visibleCase(user, String(req.params.id))
  if (!canManageTeam(user, c)) throw forbidden('Only the senior main lawyer or a firm admin can change the case team')
  const body = parse(z.object(team), req.body)
  if (body.mainLawyerId !== undefined && body.mainLawyerId !== c.mainLawyerId && !user.isFirmAdmin) {
    throw forbidden('Only a firm admin can change the main lawyer')
  }
  const next = {
    mainLawyerId: body.mainLawyerId ?? c.mainLawyerId,
    assignedJuniorId: body.assignedJuniorId !== undefined ? body.assignedJuniorId : c.assignedJuniorId,
    helperStaffId: body.helperStaffId !== undefined ? body.helperStaffId : c.helperStaffId,
  }
  let picked
  try {
    picked = await validateTeam(c.officeId, next)
  } catch (e) {
    throw badRequest((e as Error).message)
  }
  const [updated] = await db.update(schema.cases).set(picked).where(eq(schema.cases.id, c.id)).returning()
  const before = new Set(teamOf(c))
  const after = new Set(teamOf(updated))
  await notify([...after].filter((id) => !before.has(id)), { caseId: c.id, kind: 'assigned', message: `${user.name} added you to "${c.title}"`, actorId: user.id })
  await notify([...before].filter((id) => !after.has(id)), { caseId: null, kind: 'unassigned', message: `${user.name} removed you from "${c.title}"`, actorId: user.id })
  res.json({ case: updated })
})

casesRouter.delete('/:id', async (req, res) => {
  const user = req.user!
  const c = await visibleCase(user, String(req.params.id))
  if (!canEditCase(user, c)) throw forbidden('Only the main lawyer or a firm admin can delete this case')
  await db.delete(schema.cases).where(eq(schema.cases.id, c.id))
  await notify(teamOf(c), { caseId: null, kind: 'unassigned', message: `${user.name} deleted the case "${c.title}"`, actorId: user.id })
  res.json({ ok: true })
})

/** "Send briefing now": today's hearing-day briefing to the client (main lawyer or firm admin, once a day). */
casesRouter.post('/:id/briefing', async (req, res) => {
  const user = req.user!
  const c = await visibleCase(user, String(req.params.id))
  if (!canEditCase(user, c)) throw forbidden('Only the main lawyer or a firm admin can send the briefing')
  if (c.status !== 'active') throw badRequest('This case is closed')
  if (c.hearingDate !== courtDate()) throw badRequest('The briefing can only be sent on the hearing day')
  const [result] = await sendBriefings([c.id])
  if (result?.status === 'already_sent') throw new HttpError(409, "Today's briefing was already sent")
  res.status(201).json({ ok: true, briefing: await todaysBriefing(c.id) })
})
