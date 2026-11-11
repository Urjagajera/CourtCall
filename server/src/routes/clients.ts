import { and, asc, eq, inArray } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { forbidden, notFound, parse } from '../lib/http.js'
import { ncClientId } from '../lib/nexconn.js'
import { assignClient, clientScope, inScope } from '../lib/visibility.js'

// Clients are private to a firm. Firm admins see all of them; other lawyers and staff see the
// clients assigned to them.
export const clientsRouter = Router()
clientsRouter.use(requireAuth, requireRole('lawyer', 'staff'), requireVerified)

const clientInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(15).optional(),
  language: z.enum(['en', 'hi', 'gu']).default('en'),
})

clientsRouter.get('/', async (req, res) => {
  const scope = await clientScope(req.user!)
  const rows = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.officeId, req.user!.officeId!), inScope(schema.clients.id, scope)))
    .orderBy(asc(schema.clients.name))
  const ids = rows.map((r) => r.id)
  const assignees = ids.length
    ? await db
        .select({ clientId: schema.clientAssignments.clientId, id: schema.users.id, name: schema.users.name, role: schema.users.role })
        .from(schema.clientAssignments)
        .innerJoin(schema.users, eq(schema.users.id, schema.clientAssignments.userId))
        .where(inArray(schema.clientAssignments.clientId, ids))
    : []
  // ncId = the client's Nexconn user ID, used by the browser to open a direct chat.
  res.json({
    clients: rows.map((c) => ({
      ...c,
      ncId: ncClientId(c.id),
      assignees: assignees.filter((a) => a.clientId === c.id).map(({ id, name, role }) => ({ id, name, role })),
    })),
  })
})

clientsRouter.post('/', async (req, res) => {
  const body = parse(clientInput, req.body)
  const [client] = await db
    .insert(schema.clients)
    .values({ ...body, officeId: req.user!.officeId! })
    .returning()
  // Whoever adds a client looks after them (firm admins see everyone anyway).
  if (!req.user!.isFirmAdmin) await assignClient(client.id, client.officeId, [req.user!.id])
  res.status(201).json({ client })
})

async function clientInScope(req: import('express').Request) {
  const id = String(req.params.id)
  const scope = await clientScope(req.user!)
  const [c] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, id), eq(schema.clients.officeId, req.user!.officeId!), inScope(schema.clients.id, scope)))
  if (!c) throw notFound('Client not found')
  return c
}

clientsRouter.patch('/:id', async (req, res) => {
  const body = parse(clientInput.partial(), req.body)
  const c = await clientInScope(req)
  const [client] = await db.update(schema.clients).set(body).where(eq(schema.clients.id, c.id)).returning()
  res.json({ client })
})

/** Who looks after this client. Firm admins only: replaces the whole list. */
clientsRouter.put('/:id/assignees', async (req, res) => {
  if (!req.user!.isFirmAdmin) throw forbidden('Only a firm admin can change who looks after a client')
  const { userIds } = parse(z.object({ userIds: z.array(z.uuid()).max(50) }), req.body)
  const c = await clientInScope(req)
  await db.delete(schema.clientAssignments).where(eq(schema.clientAssignments.clientId, c.id))
  await assignClient(c.id, c.officeId, userIds)
  res.json({ ok: true })
})

clientsRouter.delete('/:id', async (req, res) => {
  const c = await clientInScope(req)
  await db.delete(schema.clients).where(eq(schema.clients.id, c.id))
  res.json({ ok: true })
})
