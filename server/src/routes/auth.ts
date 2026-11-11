import { eq } from 'drizzle-orm'
import { newInviteCode } from './office.js'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { db, schema } from '../db/index.js'
import { DEMO_ACCOUNTS, type DemoKey } from '../lib/demo.js'
import {
  checkPassword,
  clearSessionCookie,
  hashPassword,
  currentUser,
  publicUser,
  requireAuth,
  setSessionCookie,
} from '../lib/auth.js'
import { HttpError, badRequest, parse, unauthorized } from '../lib/http.js'

export const authRouter = Router()

const base = {
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().min(10).max(15),
  password: z.string().min(8).max(100),
}

const lawyerSignup = z.object({
  ...base,
  barCouncilNo: z.string().trim().min(3).max(40),
  officeName: z.string().trim().min(2).max(100),
})

const memberSignup = z
  .object({
    ...base,
    role: z.enum(['lawyer', 'junior', 'staff']),
    barCouncilNo: z.string().trim().max(40).optional(),
    inviteCode: z.string().trim().toUpperCase().length(6),
  })
  .refine((b) => b.role !== 'lawyer' || (b.barCouncilNo?.length ?? 0) >= 3, {
    path: ['barCouncilNo'],
    message: 'Senior lawyers need a Bar Council enrolment number',
  })

async function ensureEmailFree(email: string) {
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email))
  if (existing) throw new HttpError(409, 'An account with this email already exists')
}

// Senior lawyer founding a firm: creates the account + the firm, and becomes its first firm admin.
// Needs CourtCall verification (Bar Council check) before using the app.
authRouter.post('/register/lawyer', async (req, res) => {
  const body = parse(lawyerSignup, req.body)
  await ensureEmailFree(body.email)
  const passwordHash = await hashPassword(body.password)

  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(schema.users)
      .values({
        role: 'lawyer',
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash,
        barCouncilNo: body.barCouncilNo,
        isFirmAdmin: true,
      })
      .returning()
    const [office] = await tx
      .insert(schema.offices)
      .values({ name: body.officeName, ownerId: u.id, inviteCode: newInviteCode() })
      .returning()
    const [updated] = await tx
      .update(schema.users)
      .set({ officeId: office.id })
      .where(eq(schema.users.id, u.id))
      .returning()
    return updated
  })

  setSessionCookie(res, user.id)
  res.status(201).json({ user: publicUser(user) })
})

// Senior lawyer, junior or office staff joining an existing firm with its invite code.
// They wait until a firm admin of that firm approves them.
async function registerMember(reqBody: unknown, res: import('express').Response) {
  const body = parse(memberSignup, reqBody)
  const [office] = await db.select().from(schema.offices).where(eq(schema.offices.inviteCode, body.inviteCode))
  if (!office) throw badRequest('Invalid firm invite code')
  await ensureEmailFree(body.email)

  const [user] = await db
    .insert(schema.users)
    .values({
      role: body.role,
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash: await hashPassword(body.password),
      barCouncilNo: body.role === 'staff' ? null : body.barCouncilNo || null,
      officeId: office.id,
    })
    .returning()

  setSessionCookie(res, user.id)
  res.status(201).json({ user: publicUser(user) })
}

authRouter.post('/register/member', (req, res) => registerMember(req.body, res))
// Older clients: junior signup without a role field.
authRouter.post('/register/junior', (req, res) => registerMember({ ...req.body, role: 'junior' }, res))

authRouter.post('/login', async (req, res) => {
  const body = parse(z.object({ email: base.email, password: z.string().min(1) }), req.body)
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
  if (!user || !(await checkPassword(body.password, user.passwordHash))) {
    throw unauthorized('Wrong email or password')
  }
  setSessionCookie(res, user.id)
  res.json({ user: publicUser(user) })
})

// ---- One-tap demo login (only when DEMO_LOGIN=true) ----

authRouter.get('/demo', (_req, res) => {
  res.json({
    enabled: config.demoLogin,
    accounts: config.demoLogin ? DEMO_ACCOUNTS.map(({ key, label, name, description }) => ({ key, label, name, description })) : [],
  })
})

authRouter.post('/demo', async (req, res) => {
  if (!config.demoLogin) throw new HttpError(404, 'Demo login is turned off')
  const keys = DEMO_ACCOUNTS.map((a) => a.key) as [DemoKey, ...DemoKey[]]
  const { account } = parse(z.object({ account: z.enum(keys) }), req.body)
  const email = DEMO_ACCOUNTS.find((a) => a.key === account)!.email
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email))
  if (!user) throw new HttpError(404, 'Demo data is missing. Run: npm --prefix server run seed:demo')
  setSessionCookie(res, user.id)
  res.json({ user: publicUser(user) })
})

/** Marks the first-login guided tour as seen (finished or ended early). */
authRouter.post('/tour', requireAuth, async (req, res) => {
  const [user] = await db
    .update(schema.users)
    .set({ tourCompletedAt: new Date() })
    .where(eq(schema.users.id, req.user!.id))
    .returning()
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

// Answers 200 with { user: null } for visitors, so the landing page doesn't log a 401 error.
authRouter.get('/me', async (req, res) => {
  const user = await currentUser(req)
  if (!user) {
    res.json({ user: null, office: null })
    return
  }
  const office = user.officeId
    ? (await db.select().from(schema.offices).where(eq(schema.offices.id, user.officeId)))[0]
    : null
  res.json({
    user: publicUser(user),
    office: office
      ? {
          id: office.id,
          name: office.name,
          // Only firm admins see the invite code.
          inviteCode: user.isFirmAdmin ? office.inviteCode : undefined,
          isFounder: office.ownerId === user.id,
        }
      : null,
  })
})
