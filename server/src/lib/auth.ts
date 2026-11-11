import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { db, schema } from '../db/index.js'
import type { User } from '../db/schema.js'
import { forbidden, unauthorized } from './http.js'

const COOKIE = 'cc_session'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10)
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export function setSessionCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { path: '/' })
}

/** Loads the signed-in staff user (lawyer / junior / admin) from the session cookie. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE]
  if (!token) throw unauthorized()
  let userId: string
  try {
    userId = (jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub as string
  } catch {
    throw unauthorized('Session expired, please sign in again')
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId))
  if (!user) throw unauthorized()
  req.user = user
  next()
}

/** The signed-in staff user, or null (no error) when there is no valid session. */
export async function currentUser(req: Request): Promise<User | null> {
  const token = req.cookies?.[COOKIE]
  if (!token) return null
  try {
    const userId = (jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub as string
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId))
    return user ?? null
  } catch {
    return null
  }
}

export function requireRole(...roles: User['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden()
    next()
  }
}

/** Blocks accounts that are not yet verified (lawyers by admin, juniors by their senior). */
export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.verificationStatus !== 'verified') {
    throw forbidden('Your account is awaiting verification')
  }
  next()
}

/** Firm management (people, roles, invite code). Needs a verified firm admin in a firm. */
export function requireFirmAdmin(req: Request, _res: Response, next: NextFunction) {
  const u = req.user
  if (!u?.officeId || !u.isFirmAdmin || u.verificationStatus !== 'verified') throw forbidden('Only a firm admin can do this')
  next()
}

/** Strips secrets before sending a user to the browser. */
export function publicUser(u: User) {
  const { passwordHash: _omit, ...rest } = u
  return rest
}
