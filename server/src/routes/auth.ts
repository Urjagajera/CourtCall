import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import {
  checkPassword,
  clearSessionCookie,
  hashPassword,
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

const juniorSignup = z.object({
  ...base,
  barCouncilNo: z.string().trim().max(40).optional(),
  inviteCode: z.string().trim().toUpperCase().length(6),
})

// No 0/O/1/I so codes are easy to read out over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newInviteCode = () => [...randomBytes(6)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

async function ensureEmailFree(email: string) {
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email))
  if (existing) throw new HttpError(409, 'An account with this email already exists')
}

// Senior lawyer: creates the account + their office. Needs admin verification before using the app.
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

// Junior: joins an existing office using its invite code. The senior lawyer approves them.
authRouter.post('/register/junior', async (req, res) => {
  const body = parse(juniorSignup, req.body)
  const [office] = await db.select().from(schema.offices).where(eq(schema.offices.inviteCode, body.inviteCode))
  if (!office) throw badRequest('Invalid office invite code')
  await ensureEmailFree(body.email)

  const [user] = await db
    .insert(schema.users)
    .values({
      role: 'junior',
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash: await hashPassword(body.password),
      barCouncilNo: body.barCouncilNo,
      officeId: office.id,
    })
    .returning()

  setSessionCookie(res, user.id)
  res.status(201).json({ user: publicUser(user) })
})

authRouter.post('/login', async (req, res) => {
  const body = parse(z.object({ email: base.email, password: z.string().min(1) }), req.body)
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
  if (!user || !(await checkPassword(body.password, user.passwordHash))) {
    throw unauthorized('Wrong email or password')
  }
  setSessionCookie(res, user.id)
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = req.user!
  const office = user.officeId
    ? (await db.select().from(schema.offices).where(eq(schema.offices.id, user.officeId)))[0]
    : null
  res.json({
    user: publicUser(user),
    office: office
      ? {
          id: office.id,
          name: office.name,
          // Only the office owner sees the invite code.
          inviteCode: office.ownerId === user.id ? office.inviteCode : undefined,
        }
      : null,
  })
})
