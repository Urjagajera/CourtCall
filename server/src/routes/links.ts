import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import type { User } from '../db/schema.js'
import { DEMO_LINK_LABEL, newLinkToken, sha256 } from '../lib/clientAccess.js'
import { assignClient, canSeeClient, clientScope, inScope } from '../lib/visibility.js'
import { badRequest, notFound, parse } from '../lib/http.js'

// Firm side of client links: create, list, revoke, reissue. Only lawyers and staff of the case's firm.
export const linksRouter = Router()
const firm = [requireAuth, requireVerified, requireRole('lawyer', 'staff')]

/** The case, if it belongs to this person's firm AND to a client they may see. */
async function caseInMyFirm(caseId: string, user: User) {
  if (!user.officeId) throw notFound('Case not found')
  const scope = await clientScope(user)
  const [c] = await db
    .select()
    .from(schema.cases)
    .where(and(eq(schema.cases.id, caseId), eq(schema.cases.officeId, user.officeId), inScope(schema.cases.clientId, scope)))
  if (!c) throw notFound('Case not found')
  return c
}

async function linkInMyFirm(linkId: string, user: User) {
  const [row] = await db
    .select({ link: schema.accessLinks, officeId: schema.cases.officeId, clientId: schema.cases.clientId })
    .from(schema.accessLinks)
    .innerJoin(schema.cases, eq(schema.cases.id, schema.accessLinks.caseId))
    .where(eq(schema.accessLinks.id, linkId))
  if (!row || row.officeId !== user.officeId || !(await canSeeClient(user, row.clientId))) throw notFound('Link not found')
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
  const c = await caseInMyFirm(String(req.params.id), req.user!)
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

/**
 * The raw token is returned only here, once. Only its hash is stored.
 * Sharing a link also sets who looks after the client: the sharer plus anyone in `assignTo`.
 */
linksRouter.post('/cases/:id/links', ...firm, async (req, res) => {
  const body = parse(
    z.object({
      kind: z.enum(['client', 'family']).default('client'),
      label: z.string().trim().max(60).optional(),
      assignTo: z.array(z.uuid()).max(50).optional(),
    }),
    req.body,
  )
  const c = await caseInMyFirm(String(req.params.id), req.user!)
  // The client only follows what the firm entered, so the case must be complete first.
  if (!c.caseNo) throw badRequest('Add the case number before sharing a link')
  if (c.status === 'closed') throw badRequest('This case is closed. Reopen it with a new case to share a link')
  await assignClient(c.clientId, c.officeId, [...(req.user!.isFirmAdmin ? [] : [req.user!.id]), ...(body.assignTo ?? [])])
  const { link, token } = await createLink(c.id, body.kind, body.label || null, req.user!.id)
  res.status(201).json({ link: view(link, req.user!.name), token })
})

linksRouter.post('/links/:id/revoke', ...firm, async (req, res) => {
  const link = await linkInMyFirm(String(req.params.id), req.user!)
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
  const old = await linkInMyFirm(String(req.params.id), req.user!)
  if (!old.revokedAt) await db.update(schema.accessLinks).set({ revokedAt: new Date() }).where(eq(schema.accessLinks.id, old.id))
  const { link, token } = await createLink(old.caseId, old.kind, old.label, req.user!.id)
  res.status(201).json({ link: view(link, req.user!.name), token })
})
