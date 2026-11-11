import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requireAuth, requireRole, requireVerified } from '../lib/auth.js'
import { upsertCourtroom } from '../lib/courtrooms.js'
import { EVENT_TYPES, courtDate } from '../lib/engine.js'
import { forbidden, notFound, parse } from '../lib/http.js'
import {
  activeReporterCount,
  applyEvent,
  getOrCreateSession,
  isMember,
  joinSession,
  officeCasesIn,
  recentEvents,
  sessionView,
  sessionsForUser,
} from '../lib/sessions.js'

// Shared courtroom rooms. Open to verified lawyers and juniors from any office.
export const courtroomsRouter = Router()
// Guard per route (not router.use) because this router is mounted at /api.
const staff = [requireAuth, requireVerified, requireRole('lawyer', 'junior')]

/** Today's rooms for me, each with live state and only MY office's cases in it. */
courtroomsRouter.get('/courtrooms/today', ...staff, async (req, res) => {
  const user = req.user!
  const date = courtDate()
  const rows = await sessionsForUser(user, date)
  const sessions = await Promise.all(
    rows.map(async ({ session, courtroom }) => ({
      ...sessionView(session),
      courtroom: { id: courtroom.id, courtComplex: courtroom.courtComplex, roomNo: courtroom.roomNo },
      myCases: user.officeId ? await officeCasesIn(user.officeId, courtroom.id, date) : [],
    })),
  )
  res.json({ date, sessions })
})

/** Join a courtroom room for today (e.g. a junior covering a room for the day). */
courtroomsRouter.post('/courtrooms/join', ...staff, async (req, res) => {
  const body = parse(
    z.object({ courtComplex: z.string().trim().min(2).max(100), roomNo: z.string().trim().min(1).max(20) }),
    req.body,
  )
  const room = await upsertCourtroom(body.courtComplex, body.roomNo)
  const session = await getOrCreateSession(room.id, courtDate())
  await joinSession(session.id, req.user!.id)
  res.status(201).json({ sessionId: session.id })
})

/** Courtroom names already in use, for autocomplete so offices land in the same room. */
courtroomsRouter.get('/courtrooms', ...staff, async (_req, res) => {
  const rooms = await db.select().from(schema.courtrooms)
  res.json({ courtrooms: rooms })
})

async function loadMemberSession(sessionId: string, userId: string) {
  const [row] = await db
    .select({ session: schema.courtSessions, courtroom: schema.courtrooms })
    .from(schema.courtSessions)
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.courtSessions.courtroomId))
    .where(eq(schema.courtSessions.id, sessionId))
  if (!row) throw notFound('Courtroom not found')
  if (!(await isMember(sessionId, userId))) throw forbidden('Join this courtroom first')
  return row
}

courtroomsRouter.get('/sessions/:id', ...staff, async (req, res) => {
  const user = req.user!
  const id = parse(z.uuid(), req.params.id)
  const { session, courtroom } = await loadMemberSession(id, user.id)
  const [events, activeReporters, myCases] = await Promise.all([
    recentEvents(id),
    activeReporterCount(id),
    user.officeId ? officeCasesIn(user.officeId, courtroom.id, session.date) : [],
  ])
  res.json({
    session: sessionView(session),
    courtroom: { id: courtroom.id, courtComplex: courtroom.courtComplex, roomNo: courtroom.roomNo },
    events,
    activeReporters,
    myCases,
  })
})

const eventInput = z.object({
  type: z.enum(EVENT_TYPES),
  item: z.coerce.number().int().min(1).max(5000).nullable().optional(),
  baseVersion: z.number().int().min(0),
  confirm: z.boolean().optional(),
  correctsEventId: z.uuid().optional(),
})

courtroomsRouter.post('/sessions/:id/events', ...staff, async (req, res) => {
  const user = req.user!
  const id = parse(z.uuid(), req.params.id)
  const body = parse(eventInput, req.body)
  await loadMemberSession(id, user.id)

  const result = await applyEvent(id, user, body)
  switch (result.kind) {
    case 'applied':
      // Hook point: Nexconn room message + client alerts are sent from here (next modules).
      res.status(201).json({ session: sessionView(result.session), event: result.event })
      return
    case 'conflict':
      res.status(409).json({
        error: 'Someone else reported a newer update. Please check the latest progress.',
        code: 'conflict',
        session: sessionView(result.session),
      })
      return
    case 'confirm':
      res.json({ needsConfirmation: { reason: result.reason, message: result.message }, session: sessionView(result.session) })
      return
    case 'noop':
      res.json({ noop: result.message, session: sessionView(result.session) })
      return
    case 'reject':
      res.status(400).json({ error: result.message })
  }
})
