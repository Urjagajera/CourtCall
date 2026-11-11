import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { config, nexconnEnabled } from '../config.js'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { courtDate } from '../lib/engine.js'
import { HttpError } from '../lib/http.js'
import { createGroup, issueToken, joinGroup, ncOfficeGroupId, ncStaffId, safely } from '../lib/nexconn.js'
import { syncChatMembership } from '../lib/sessions.js'

export const chatRouter = Router()

/**
 * Gives a signed-in lawyer/junior a Nexconn token for the browser SDK, and makes sure their
 * office team room and today's courtroom rooms include them (self-healing if an earlier sync failed).
 */
chatRouter.post('/token', requireAuth, requireVerified, requireRole('lawyer', 'junior'), async (req, res) => {
  if (!nexconnEnabled) throw new HttpError(503, 'Chat is not configured on this server')
  const user = req.user!
  const ncId = ncStaffId(user.id)
  const token = await issueToken(ncId, user.name)

  let team: { groupId: string; name: string; members: { ncId: string; name: string; role: string }[] } | null = null
  if (user.officeId) {
    const [office] = await db.select().from(schema.offices).where(eq(schema.offices.id, user.officeId))
    const staff = await db
      .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role })
      .from(schema.users)
      .where(and(eq(schema.users.officeId, user.officeId), eq(schema.users.verificationStatus, 'verified')))
    const groupId = ncOfficeGroupId(user.officeId)
    await safely('office team room', async () => {
      if (!office.nexconnTeamGroupId) {
        await createGroup(groupId, `${office.name} · Team`)
        await db.update(schema.offices).set({ nexconnTeamGroupId: groupId }).where(eq(schema.offices.id, office.id))
      }
      await joinGroup(groupId, [ncId])
    })
    team = { groupId, name: office.name, members: staff.map((s) => ({ ncId: ncStaffId(s.id), name: s.name, role: s.role })) }
  }

  const today = await db
    .select({ id: schema.courtSessions.id })
    .from(schema.courtSessionMembers)
    .innerJoin(schema.courtSessions, eq(schema.courtSessions.id, schema.courtSessionMembers.sessionId))
    .where(and(eq(schema.courtSessionMembers.userId, user.id), eq(schema.courtSessions.date, courtDate())))
  for (const s of today) await syncChatMembership(s.id, [user.id])

  res.json({ appKey: config.nexconn.appKey, userId: ncId, token, team })
})
