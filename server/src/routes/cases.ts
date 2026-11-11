import { and, asc, eq, getTableColumns } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { upsertCourtroom } from '../lib/courtrooms.js'
import { badRequest, notFound, parse } from '../lib/http.js'
import { clientScope, inScope } from '../lib/visibility.js'

// Cases map an office's client to a courtroom + date + item number. Private to the office.
export const casesRouter = Router()
casesRouter.use(requireAuth, requireVerified)

const caseInput = z.object({
  clientId: z.uuid(),
  title: z.string().trim().min(2).max(160),
  caseNo: z.string().trim().max(60).optional(),
  courtComplex: z.string().trim().min(2).max(100),
  roomNo: z.string().trim().min(1).max(20),
  hearingDate: z.iso.date(),
  itemNo: z.coerce.number().int().min(1).max(2000),
  assignedJuniorId: z.uuid().nullable().optional(),
})

async function assertOfficeClient(officeId: string, clientId: string, scope: string[] | null) {
  const [c] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.officeId, officeId), inScope(schema.clients.id, scope)))
  if (!c) throw badRequest('Client not found in your office')
}

async function assertOfficeJunior(officeId: string, juniorId: string | null | undefined) {
  if (!juniorId) return
  const [j] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, juniorId),
        eq(schema.users.officeId, officeId),
        eq(schema.users.role, 'junior'),
        eq(schema.users.verificationStatus, 'verified'),
      ),
    )
  if (!j) throw badRequest('Junior must be a verified member of your office')
}

// Firm admins and juniors see all firm cases; other lawyers and staff see their assigned clients' cases.
casesRouter.get('/', requireRole('lawyer', 'junior', 'staff'), async (req, res) => {
  const date = req.query.date ? parse(z.iso.date(), req.query.date) : undefined
  const scope = await clientScope(req.user!)
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
    .where(
      and(
        eq(schema.cases.officeId, req.user!.officeId!),
        date ? eq(schema.cases.hearingDate, date) : undefined,
        inScope(schema.cases.clientId, scope),
      ),
    )
    .orderBy(asc(schema.cases.hearingDate), asc(schema.courtrooms.roomNo), asc(schema.cases.itemNo))
  res.json({ cases: rows })
})

casesRouter.post('/', requireRole('lawyer', 'staff'), async (req, res) => {
  const body = parse(caseInput, req.body)
  const officeId = req.user!.officeId!
  const scope = await clientScope(req.user!)
  await assertOfficeClient(officeId, body.clientId, scope)
  await assertOfficeJunior(officeId, body.assignedJuniorId)
  const room = await upsertCourtroom(body.courtComplex, body.roomNo)

  const [created] = await db
    .insert(schema.cases)
    .values({
      officeId,
      clientId: body.clientId,
      title: body.title,
      caseNo: body.caseNo,
      courtroomId: room.id,
      hearingDate: body.hearingDate,
      itemNo: body.itemNo,
      assignedJuniorId: body.assignedJuniorId ?? null,
    })
    .returning()
  res.status(201).json({ case: created })
})

casesRouter.patch('/:id', requireRole('lawyer', 'staff'), async (req, res) => {
  const body = parse(caseInput.partial(), req.body)
  const officeId = req.user!.officeId!
  const scope = await clientScope(req.user!)
  if (body.clientId) await assertOfficeClient(officeId, body.clientId, scope)
  await assertOfficeJunior(officeId, body.assignedJuniorId)

  const { courtComplex, roomNo, ...rest } = body
  const update: Partial<typeof schema.cases.$inferInsert> = { ...rest }
  if (courtComplex || roomNo) {
    if (!courtComplex || !roomNo) throw badRequest('Send both courtComplex and roomNo to change the courtroom')
    update.courtroomId = (await upsertCourtroom(courtComplex, roomNo)).id
  }

  const [updated] = await db
    .update(schema.cases)
    .set(update)
    .where(and(eq(schema.cases.id, String(req.params.id)), eq(schema.cases.officeId, officeId), inScope(schema.cases.clientId, scope)))
    .returning()
  if (!updated) throw notFound('Case not found')
  res.json({ case: updated })
})

casesRouter.delete('/:id', requireRole('lawyer', 'staff'), async (req, res) => {
  const scope = await clientScope(req.user!)
  const [deleted] = await db
    .delete(schema.cases)
    .where(and(eq(schema.cases.id, String(req.params.id)), eq(schema.cases.officeId, req.user!.officeId!), inScope(schema.cases.clientId, scope)))
    .returning({ id: schema.cases.id })
  if (!deleted) throw notFound('Case not found')
  res.json({ ok: true })
})
