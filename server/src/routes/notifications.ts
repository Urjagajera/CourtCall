import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { parse } from '../lib/http.js'
import { pendingOutcomes } from './hearings.js'

// "Something new" for the signed-in person: the Updates list on Today and the number on the sidebar.
// New items are also pinged instantly over Nexconn (CC:Notice, see lib/notify.ts).
export const notificationsRouter = Router()
notificationsRouter.use(requireAuth, requireVerified, requireRole('lawyer', 'junior', 'staff'))

notificationsRouter.get('/', async (req, res) => {
  const [items, todos] = await Promise.all([
    db
      .select({
        id: schema.notifications.id,
        caseId: schema.notifications.caseId,
        kind: schema.notifications.kind,
        message: schema.notifications.message,
        readAt: schema.notifications.readAt,
        createdAt: schema.notifications.createdAt,
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, req.user!.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(30),
    pendingOutcomes(req),
  ])
  res.json({
    items,
    unread: items.filter((i) => !i.readAt).length,
    // Hearings this person must update (main lawyer / firm admin); they also count in the badge.
    todos: todos.length,
  })
})

/** Mark read: specific ids, everything about one case (opening it), or all. */
notificationsRouter.post('/read', async (req, res) => {
  const body = parse(z.object({ ids: z.array(z.uuid()).max(100).optional(), caseId: z.uuid().optional(), all: z.boolean().optional() }), req.body)
  const mine = and(eq(schema.notifications.userId, req.user!.id), isNull(schema.notifications.readAt))
  const which = body.all
    ? mine
    : body.caseId
      ? and(mine, eq(schema.notifications.caseId, body.caseId))
      : body.ids?.length
        ? and(mine, inArray(schema.notifications.id, body.ids))
        : null
  if (which) await db.update(schema.notifications).set({ readAt: new Date() }).where(which)
  res.json({ ok: true })
})
