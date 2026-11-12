// Client access by private link: no passwords. A link is bound to the first phone that opens it,
// and that phone then holds a client session cookie (separate from staff sign-in).
import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { db, schema } from '../db/index.js'
import { HttpError } from './http.js'

const COOKIE = 'cc_client'
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

export const newLinkToken = () => randomBytes(24).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Fixed token for the seeded demo client link (only usable through the demo endpoint when DEMO_LOGIN=true). */
export const DEMO_CLIENT_TOKEN = 'demo-ramesh-patel'
export const DEMO_LINK_LABEL = 'Demo client link'

export function setClientCookie(res: Response, linkId: string) {
  const token = jwt.sign({ lid: linkId, aud: 'client' }, config.jwtSecret, { expiresIn: '180d' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

export function clearClientCookie(res: Response) {
  res.clearCookie(COOKIE, { path: '/' })
}

export interface ClientContext {
  link: typeof schema.accessLinks.$inferSelect
  case: typeof schema.cases.$inferSelect
  client: typeof schema.clients.$inferSelect
  office: typeof schema.offices.$inferSelect
  courtroom: typeof schema.courtrooms.$inferSelect
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clientCtx?: ClientContext
    }
  }
}

/** Loads the client's link, case, client, firm and courtroom from the client cookie (one query). */
export async function requireClient(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE]
  if (!token) throw new HttpError(401, 'Open the link your lawyer shared on WhatsApp')
  let linkId: string
  try {
    linkId = (jwt.verify(token, config.jwtSecret, { audience: 'client' }) as jwt.JwtPayload).lid as string
  } catch {
    throw new HttpError(401, 'Open the link your lawyer shared on WhatsApp')
  }
  const [row] = await db
    .select({
      link: schema.accessLinks,
      case: schema.cases,
      client: schema.clients,
      office: schema.offices,
      courtroom: schema.courtrooms,
    })
    .from(schema.accessLinks)
    .innerJoin(schema.cases, eq(schema.cases.id, schema.accessLinks.caseId))
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.offices, eq(schema.offices.id, schema.cases.officeId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .where(eq(schema.accessLinks.id, linkId))
  if (!row) throw new HttpError(401, 'This link no longer exists. Ask your lawyer for a new one.')
  // Family links were removed (Nov 2026): any that were shared before stop working.
  if (row.link.revokedAt || row.link.kind !== 'client') throw new HttpError(410, 'This link was turned off. Ask your lawyer for a new one.')
  req.clientCtx = row
  next()
}
