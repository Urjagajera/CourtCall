import { and, asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { notFound, parse } from '../lib/http.js'

// Clients are private to an office. Only the senior lawyer manages them.
export const clientsRouter = Router()
clientsRouter.use(requireAuth, requireRole('lawyer'), requireVerified)

const clientInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(15).optional(),
  language: z.enum(['en', 'hi', 'gu']).default('en'),
})

clientsRouter.get('/', async (req, res) => {
  const rows = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.officeId, req.user!.officeId!))
    .orderBy(asc(schema.clients.name))
  res.json({ clients: rows })
})

clientsRouter.post('/', async (req, res) => {
  const body = parse(clientInput, req.body)
  const [client] = await db
    .insert(schema.clients)
    .values({ ...body, officeId: req.user!.officeId! })
    .returning()
  res.status(201).json({ client })
})

clientsRouter.patch('/:id', async (req, res) => {
  const body = parse(clientInput.partial(), req.body)
  const [client] = await db
    .update(schema.clients)
    .set(body)
    .where(and(eq(schema.clients.id, String(req.params.id)), eq(schema.clients.officeId, req.user!.officeId!)))
    .returning()
  if (!client) throw notFound('Client not found')
  res.json({ client })
})

clientsRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.clients)
    .where(and(eq(schema.clients.id, String(req.params.id)), eq(schema.clients.officeId, req.user!.officeId!)))
    .returning({ id: schema.clients.id })
  if (!deleted) throw notFound('Client not found')
  res.json({ ok: true })
})
