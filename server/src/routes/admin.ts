import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { publicUser, requireAuth, requireRole } from '../lib/auth.js'
import { notFound, parse } from '../lib/http.js'

// Platform admin: manual verification of senior lawyers (Bar Council number check).
export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'))

adminRouter.get('/lawyers', async (req, res) => {
  const status = parse(
    z.enum(['pending', 'verified', 'rejected']).default('pending'),
    req.query.status,
  )
  // Only firm founders. Everyone who joins an existing firm is approved by that firm's admins.
  const rows = await db
    .select({ user: schema.users, officeName: schema.offices.name })
    .from(schema.users)
    .innerJoin(schema.offices, eq(schema.offices.ownerId, schema.users.id))
    .where(and(eq(schema.users.role, 'lawyer'), eq(schema.users.verificationStatus, status)))
    .orderBy(desc(schema.users.createdAt))
  res.json({ lawyers: rows.map((r) => ({ ...publicUser(r.user), officeName: r.officeName })) })
})

adminRouter.post('/lawyers/:id/verification', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['verified', 'rejected']) }), req.body)
  const id = String(req.params.id)
  const [founder] = await db.select({ id: schema.offices.id }).from(schema.offices).where(eq(schema.offices.ownerId, id))
  if (!founder) throw notFound('Only firm founders are verified by CourtCall')
  const [updated] = await db
    .update(schema.users)
    .set({ verificationStatus: status })
    .where(and(eq(schema.users.id, id), eq(schema.users.role, 'lawyer')))
    .returning()
  if (!updated) throw notFound('Lawyer not found')
  res.json({ user: publicUser(updated) })
})
