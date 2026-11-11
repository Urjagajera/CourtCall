import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { DEMO_LINK_LABEL, newLinkToken, sha256 } from '../lib/clientAccess.js'
import { badRequest, notFound, parse } from '../lib/http.js'

// Firm side of client links: create, list, revoke, reissue. Only lawyers and staff of the case's firm.
export const linksRouter = Router()
const firm = [requireAuth, requireVerified, requireRole('lawyer', 'staff')]

async function caseInMyFirm(caseId: string, officeId: string | null) {
  if (!officeId) throw notFound('Case not found')
  const [c] = await db
    .select()
    .from(schema.cases)
    .where(and(eq(schema.cases.id, caseId), eq(schema.cases.officeId, officeId)))
  if (!c) throw notFound('Case not found')
  return c
}

async function linkInMyFirm(linkId: string, officeId: string | null) {
  const [row] = await db
    .select({ link: schema.accessLinks, officeId: schema.cases.officeId })
    .from(schema.accessLinks)
    .innerJoin(schema.cases, eq(schema.cases.id, schema.accessLinks.caseId))
    .where(eq(schema.accessLinks.id, linkId))
  if (!row || row.officeId !== officeId) throw notFound('Link not found')
  return row.link
}

const view = (l: typeof schema.accessLinks.$inferSelect, createdByName?: string | null) => ({
  id: l.id,
  kind: l.kind,
  label: l.label,
  activatedAt: l.activatedAt,
  revokedAt: l.revokedAt,
  createdAt: l.createdAt,
  createdByName: createdByName ?? null,
})

linksRouter.get('/cases/:id/links', ...firm, async (req, res) => {
  const c = await caseInMyFirm(String(req.params.id), req.user!.officeId)
  const rows = await db
    .select({ link: schema.accessLinks, createdByName: schema.users.name })
    .from(schema.accessLinks)
    .leftJoin(schema.users, eq(schema.users.id, schema.accessLinks.createdBy))
    .where(eq(schema.accessLinks.caseId, c.id))
    .orderBy(desc(schema.accessLinks.createdAt))
  // The seeded demo link stays hidden so nobody trying the demo can turn the Client demo button off.
  res.json({ links: rows.filter((r) => r.link.label !== DEMO_LINK_LABEL).map((r) => view(r.link, r.createdByName)) })
})

async function createLink(caseId: string, kind: 'client' | 'family', label: string | null, userId: string) {
  const token = newLinkToken()
  const [link] = await db
    .insert(schema.accessLinks)
    .values({ caseId, kind, label, tokenHash: sha256(token), createdBy: userId })
    .returning()
  return { link, token }
}

/** The raw token is returned only here, once. Only its hash is stored. */
linksRouter.post('/cases/:id/links', ...firm, async (req, res) => {
  const body = parse(
    z.object({ kind: z.enum(['client', 'family']).default('client'), label: z.string().trim().max(60).optional() }),
    req.body,
  )
  const c = await caseInMyFirm(String(req.params.id), req.user!.officeId)
  const { link, token } = await createLink(c.id, body.kind, body.label || null, req.user!.id)
  res.status(201).json({ link: view(link, req.user!.name), token })
})

linksRouter.post('/links/:id/revoke', ...firm, async (req, res) => {
  const link = await linkInMyFirm(String(req.params.id), req.user!.officeId)
  if (link.revokedAt) throw badRequest('This link is already turned off')
  const [updated] = await db
    .update(schema.accessLinks)
    .set({ revokedAt: new Date() })
    .where(eq(schema.accessLinks.id, link.id))
    .returning()
  res.json({ link: view(updated) })
})

/** New phone or lost phone: turn the old link off and make a fresh one of the same kind. */
linksRouter.post('/links/:id/reissue', ...firm, async (req, res) => {
  const old = await linkInMyFirm(String(req.params.id), req.user!.officeId)
  if (!old.revokedAt) await db.update(schema.accessLinks).set({ revokedAt: new Date() }).where(eq(schema.accessLinks.id, old.id))
  const { link, token } = await createLink(old.caseId, old.kind, old.label, req.user!.id)
  res.status(201).json({ link: view(link, req.user!.name), token })
})
