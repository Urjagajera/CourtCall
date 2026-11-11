import { randomBytes } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { publicUser, requireAuth, requireFirmAdmin, requireVerified } from '../lib/auth.js'
import { badRequest, forbidden, notFound, parse } from '../lib/http.js'

// The user's own firm: everyone can see the team; firm admins manage it.
export const officeRouter = Router()
officeRouter.use(requireAuth, requireVerified)

// No 0/O/1/I so codes are easy to read out over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newInviteCode = () => [...randomBytes(6)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

async function myOffice(officeId: string | null) {
  if (!officeId) throw forbidden('You are not part of a firm')
  const [office] = await db.select().from(schema.offices).where(eq(schema.offices.id, officeId))
  if (!office) throw forbidden('You are not part of a firm')
  return office
}

officeRouter.get('/', async (req, res) => {
  const user = req.user!
  const office = await myOffice(user.officeId)
  const members = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.officeId, office.id))
    .orderBy(asc(schema.users.createdAt))
  const admin = user.isFirmAdmin
  res.json({
    office: { id: office.id, name: office.name, inviteCode: admin ? office.inviteCode : undefined, ownerId: office.ownerId },
    // Non-admins only see active colleagues (no pending or deactivated accounts, no contact details).
    members: admin
      ? members.map(publicUser)
      : members
          .filter((m) => m.verificationStatus === 'verified')
          .map((m) => ({ id: m.id, name: m.name, role: m.role, isFirmAdmin: m.isFirmAdmin && m.role === 'lawyer', verificationStatus: m.verificationStatus })),
  })
})

/** Loads a colleague in the admin's firm, refusing self-edits. */
async function colleague(adminId: string, officeId: string, id: string) {
  if (id === adminId) throw badRequest('You cannot change your own account here')
  const [m] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, id), eq(schema.users.officeId, officeId)))
  if (!m) throw notFound('Person not found in your firm')
  return m
}

/** Approve a new member, decline them, deactivate or reactivate an existing one. */
/** Approved senior lawyers and staff in my firm: who a client can be assigned to. Any member may read it. */
officeRouter.get('/people', async (req, res) => {
  const people = await db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, isFirmAdmin: schema.users.isFirmAdmin })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.officeId, req.user!.officeId!),
        eq(schema.users.verificationStatus, 'verified'),
        inArray(schema.users.role, ['lawyer', 'staff']),
      ),
    )
    .orderBy(asc(schema.users.role), asc(schema.users.name))
  res.json({ people: people.map((p) => ({ ...p, isFirmAdmin: p.isFirmAdmin && p.role === 'lawyer' })) })
})

officeRouter.post('/members/:id/verification', requireFirmAdmin, async (req, res) => {
  const admin = req.user!
  const { status } = parse(z.object({ status: z.enum(['verified', 'rejected']) }), req.body)
  const office = await myOffice(admin.officeId)
  const m = await colleague(admin.id, office.id, String(req.params.id))
  if (m.id === office.ownerId && status === 'rejected') throw badRequest('The firm founder cannot be deactivated')
  const [updated] = await db
    .update(schema.users)
    // Deactivated people also lose firm-admin rights.
    .set({ verificationStatus: status, ...(status === 'rejected' ? { isFirmAdmin: false } : {}) })
    .where(eq(schema.users.id, m.id))
    .returning()
  res.json({ user: publicUser(updated) })
})

/** Change someone's role (lawyer / junior / staff) or make / remove them as a firm admin. */
officeRouter.patch('/members/:id', requireFirmAdmin, async (req, res) => {
  const admin = req.user!
  const body = parse(
    z
      .object({ role: z.enum(['lawyer', 'junior', 'staff']).optional(), isFirmAdmin: z.boolean().optional() })
      .refine((b) => b.role !== undefined || b.isFirmAdmin !== undefined, 'Nothing to change'),
    req.body,
  )
  const office = await myOffice(admin.officeId)
  const m = await colleague(admin.id, office.id, String(req.params.id))
  if (m.id === office.ownerId && body.isFirmAdmin === false) throw badRequest('The firm founder always stays a firm admin')
  if (body.isFirmAdmin && m.verificationStatus !== 'verified') throw badRequest('Approve this person before making them a firm admin')
  // Only senior lawyers can be firm admins (never juniors or office staff).
  if (body.isFirmAdmin && (body.role ?? m.role) !== 'lawyer') throw badRequest('Only senior lawyers can be firm admins')
  if (m.id === office.ownerId && body.role && body.role !== 'lawyer') throw badRequest('The firm founder must stay a senior lawyer')
  const [updated] = await db
    .update(schema.users)
    .set({
      ...(body.role ? { role: body.role } : {}),
      // Moving someone to junior or staff removes admin rights.
      ...(body.isFirmAdmin !== undefined
        ? { isFirmAdmin: body.isFirmAdmin }
        : body.role && body.role !== 'lawyer'
          ? { isFirmAdmin: false }
          : {}),
    })
    .where(eq(schema.users.id, m.id))
    .returning()
  res.json({ user: publicUser(updated) })
})

/** New invite code (the old one stops working immediately). */
officeRouter.post('/invite-code', requireFirmAdmin, async (req, res) => {
  const office = await myOffice(req.user!.officeId)
  const [updated] = await db
    .update(schema.offices)
    .set({ inviteCode: newInviteCode() })
    .where(eq(schema.offices.id, office.id))
    .returning()
  res.json({ inviteCode: updated.inviteCode })
})
