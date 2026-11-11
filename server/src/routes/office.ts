import { and, asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { publicUser, requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { forbidden, notFound, parse } from '../lib/http.js'

// The senior lawyer's own office: team list and junior approval.
export const officeRouter = Router()
officeRouter.use(requireAuth, requireRole('lawyer'), requireVerified)

async function ownedOffice(userId: string, officeId: string | null) {
  if (!officeId) throw forbidden('No office')
  const [office] = await db.select().from(schema.offices).where(eq(schema.offices.id, officeId))
  if (!office || office.ownerId !== userId) throw forbidden('Only the office owner can do this')
  return office
}

officeRouter.get('/', async (req, res) => {
  const office = await ownedOffice(req.user!.id, req.user!.officeId)
  const members = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.officeId, office.id))
    .orderBy(asc(schema.users.createdAt))
  res.json({
    office: { id: office.id, name: office.name, inviteCode: office.inviteCode },
    members: members.map(publicUser),
  })
})

officeRouter.post('/juniors/:id/verification', async (req, res) => {
  const office = await ownedOffice(req.user!.id, req.user!.officeId)
  const { status } = parse(z.object({ status: z.enum(['verified', 'rejected']) }), req.body)
  const [updated] = await db
    .update(schema.users)
    .set({ verificationStatus: status })
    .where(
      and(
        eq(schema.users.id, String(req.params.id)),
        eq(schema.users.role, 'junior'),
        eq(schema.users.officeId, office.id),
      ),
    )
    .returning()
  if (!updated) throw notFound('Junior not found in your office')
  res.json({ user: publicUser(updated) })
})
