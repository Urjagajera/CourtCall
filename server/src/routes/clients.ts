import { and, asc, eq, inArray } from 'drizzle-orm'
import { Router, type Request } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import type { User } from '../db/schema.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { forbidden, notFound, parse } from '../lib/http.js'
import { ncClientId } from '../lib/nexconn.js'
import { canAddCases, clientScope, inScope } from '../lib/visibility.js'

// Clients are private to a firm. You see a client if you are on one of their cases (firm admins: all),
// or you added them and they have no case yet. Added by firm admins and seniors; edited by the firm
// admin or the main lawyer of their case(s).
export const clientsRouter = Router()
clientsRouter.use(requireAuth, requireRole('lawyer', 'junior', 'staff'), requireVerified)

const clientInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(15).optional(),
  language: z.enum(['en', 'hi', 'gu']).default('en'),
})

/** Who may edit / delete each client. */
async function rightsFor(user: User, clientIds: string[]) {
  const rows = clientIds.length
    ? await db
        .select({ clientId: schema.cases.clientId, mainLawyerId: schema.cases.mainLawyerId })
        .from(schema.cases)
        .where(inArray(schema.cases.clientId, clientIds))
    : []
  return (c: { id: string; createdBy: string | null }) => {
    const mine = rows.filter((r) => r.clientId === c.id)
    const leadsOne = mine.some((r) => r.mainLawyerId === user.id)
    const leadsAll = mine.length > 0 && mine.every((r) => r.mainLawyerId === user.id)
    const addedEmpty = mine.length === 0 && c.createdBy === user.id
    return {
      caseCount: mine.length,
      canEdit: user.isFirmAdmin || leadsOne || addedEmpty,
      // Deleting a client deletes all of their cases, so only someone who owns all of them.
      canDelete: user.isFirmAdmin || leadsAll || addedEmpty,
    }
  }
}

clientsRouter.get('/', async (req, res) => {
  const scope = await clientScope(req.user!)
  const rows = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.officeId, req.user!.officeId!), inScope(schema.clients.id, scope)))
    .orderBy(asc(schema.clients.name))
  const rights = await rightsFor(req.user!, rows.map((r) => r.id))
  // ncId = the client's Nexconn user ID, used by the browser to open a direct chat.
  res.json({ clients: rows.map((c) => ({ ...c, ncId: ncClientId(c.id), ...rights(c) })), canAdd: canAddCases(req.user!) })
})

clientsRouter.post('/', async (req, res) => {
  if (!canAddCases(req.user!)) throw forbidden('Only senior lawyers and firm admins can add clients')
  const body = parse(clientInput, req.body)
  const [client] = await db
    .insert(schema.clients)
    .values({ ...body, officeId: req.user!.officeId!, createdBy: req.user!.id })
    .returning()
  res.status(201).json({ client })
})

async function clientInScope(req: Request) {
  const scope = await clientScope(req.user!)
  const [c] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, parse(z.uuid(), String(req.params.id))), eq(schema.clients.officeId, req.user!.officeId!), inScope(schema.clients.id, scope)))
  if (!c) throw notFound('Client not found')
  return { client: c, rights: (await rightsFor(req.user!, [c.id]))(c) }
}

clientsRouter.patch('/:id', async (req, res) => {
  const body = parse(clientInput.partial(), req.body)
  const { client, rights } = await clientInScope(req)
  if (!rights.canEdit) throw forbidden('Only the main lawyer or a firm admin can change this client')
  const [updated] = await db.update(schema.clients).set(body).where(eq(schema.clients.id, client.id)).returning()
  res.json({ client: updated })
})

clientsRouter.delete('/:id', async (req, res) => {
  const { client, rights } = await clientInScope(req)
  if (!rights.canDelete) throw forbidden('Only a firm admin (or the main lawyer of all their cases) can delete this client')
  await db.delete(schema.clients).where(eq(schema.clients.id, client.id))
  res.json({ ok: true })
})
