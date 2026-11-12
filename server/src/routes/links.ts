import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import type { User } from '../db/schema.js'
import { DEMO_LINK_LABEL, newLinkToken, sha256 } from '../lib/clientAccess.js'
import { caseVisible } from '../lib/visibility.js'
import { badRequest, notFound, parse } from '../lib/http.js'

// Firm side of client links: create, list, revoke, reissue. Anyone on the case's team (firm admins: any case).
export const linksRouter = Router()
const firm = [requireAuth, requireVerified, requireRole('lawyer', 'junior', 'staff')]

/** The case, if this person is on its team (firm admins: any case of the firm). */
async function caseInMyFirm(caseId: string, user: User) {
  if (!user.officeId) throw notFound('Case not found')
  const [c] = await db
    .select()
    .from(schema.cases)
    .where(and(eq(schema.cases.id, caseId), eq(schema.cases.officeId, user.officeId), caseVisible(user)))
  if (!c) throw notFound('Case not found')
  return c
}

async function linkInMyFirm(linkId: string, user: User) {
  const [row] = await db
    .select({ link: schema.accessLinks })
    .from(schema.accessLinks)
    .innerJoin(schema.cases, eq(schema.cases.id, schema.accessLinks.caseId))
    .where(and(eq(schema.accessLinks.id, linkId), eq(schema.cases.officeId, user.officeId!), caseVisible(user)))
  if (!row) throw notFound('Link not found')
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

async function createLink(caseId: string, label: string | null, userId: string) {
  const kind = 'client' as const
  const token = newLinkToken()
  const [link] = await db
    .insert(schema.accessLinks)
    .values({ caseId, kind, label, tokenHash: sha256(token), createdBy: userId })
    .returning()
  return { link, token }
}

/**
 * The raw token is returned only here, once. Only its hash is stored.
 */
linksRouter.post('/cases/:id/links', ...firm, async (req, res) => {
  const body = parse(
    z.object({
      // Family links were removed (Nov 2026): every link is a client link. Old callers may still send kind.
      kind: z.literal('client').default('client'),
      label: z.string().trim().max(60).optional(),
      // Ignored since case teams (Nov 2026): who sees a client now follows the case team.
      assignTo: z.array(z.uuid()).max(50).optional(),
    }),
    req.body,
  )
  const c = await caseInMyFirm(String(req.params.id), req.user!)
  // The client only follows what the firm entered, so the case must be complete first.
  if (!c.caseNo) throw badRequest('Add the case number before sharing a link')
  if (c.status === 'closed') throw badRequest('This case is closed. Reopen it with a new case to share a link')
  const { link, token } = await createLink(c.id, body.label || null, req.user!.id)
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
  const { link, token } = await createLink(old.caseId, old.label, req.user!.id)
  res.status(201).json({ link: view(link, req.user!.name), token })
})
