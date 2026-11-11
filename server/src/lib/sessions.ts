import { and, asc, count, desc, eq, gt, inArray, ne } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { CourtEvent, CourtSession, User } from '../db/schema.js'
import { ACTIVE_REPORTER_MS, decide, isStale, type CorrectionTarget, type EventInput } from './engine.js'
import { notFound } from './http.js'

const { courtSessions, courtSessionMembers, courtEvents, courtrooms, cases, clients, users, offices } = schema

export async function getOrCreateSession(courtroomId: string, date: string) {
  await db.insert(courtSessions).values({ courtroomId, date }).onConflictDoNothing()
  const [s] = await db
    .select()
    .from(courtSessions)
    .where(and(eq(courtSessions.courtroomId, courtroomId), eq(courtSessions.date, date)))
  return s
}

export async function joinSession(sessionId: string, userId: string) {
  await db.insert(courtSessionMembers).values({ sessionId, userId }).onConflictDoNothing()
}

export async function isMember(sessionId: string, userId: string) {
  const [m] = await db
    .select({ userId: courtSessionMembers.userId })
    .from(courtSessionMembers)
    .where(and(eq(courtSessionMembers.sessionId, sessionId), eq(courtSessionMembers.userId, userId)))
  return Boolean(m)
}

/** Shape sent to staff (lawyers/juniors). Clients get a reduced view elsewhere. */
export function sessionView(s: CourtSession) {
  return {
    id: s.id,
    courtroomId: s.courtroomId,
    date: s.date,
    currentItem: s.currentItem,
    hearingItem: s.hearingItem,
    status: s.status,
    version: s.version,
    lastEventAt: s.lastEventAt,
    stale: isStale(s.status, s.lastEventAt),
  }
}

/** This office's cases in a given courtroom/day (never other offices' cases). */
export async function officeCasesIn(officeId: string, courtroomId: string, date: string) {
  return db
    .select({
      id: cases.id,
      title: cases.title,
      itemNo: cases.itemNo,
      clientName: clients.name,
      assignedJuniorId: cases.assignedJuniorId,
    })
    .from(cases)
    .innerJoin(clients, eq(clients.id, cases.clientId))
    .where(and(eq(cases.officeId, officeId), eq(cases.courtroomId, courtroomId), eq(cases.hearingDate, date)))
    .orderBy(asc(cases.itemNo))
}

export async function recentEvents(sessionId: string, limit = 30) {
  return db
    .select({
      id: courtEvents.id,
      version: courtEvents.version,
      type: courtEvents.type,
      item: courtEvents.item,
      singleReporter: courtEvents.singleReporter,
      confirmed: courtEvents.confirmed,
      correctsEventId: courtEvents.correctsEventId,
      createdAt: courtEvents.createdAt,
      reporterId: courtEvents.reporterId,
      reporterName: users.name,
      officeName: offices.name,
    })
    .from(courtEvents)
    .innerJoin(users, eq(users.id, courtEvents.reporterId))
    .leftJoin(offices, eq(offices.id, courtEvents.officeId))
    .where(eq(courtEvents.sessionId, sessionId))
    .orderBy(desc(courtEvents.version))
    .limit(limit)
}

export async function activeReporterCount(sessionId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(courtSessionMembers)
    .where(
      and(
        eq(courtSessionMembers.sessionId, sessionId),
        gt(courtSessionMembers.lastReportedAt, new Date(Date.now() - ACTIVE_REPORTER_MS)),
      ),
    )
  return r.n
}

export type ApplyResult =
  | { kind: 'applied'; session: CourtSession; event: CourtEvent }
  | { kind: 'conflict'; session: CourtSession }
  | { kind: 'confirm'; reason: 'backward' | 'jump'; message: string; session: CourtSession }
  | { kind: 'noop'; message: string; session: CourtSession }
  | { kind: 'reject'; message: string }

/**
 * Applies one reported event atomically.
 * - The session row is locked, so two reporters can never both win the same version.
 * - baseVersion must match: a delayed/older update never overwrites newer progress.
 */
export async function applyEvent(
  sessionId: string,
  reporter: User,
  input: EventInput & { baseVersion: number; correctsEventId?: string },
): Promise<ApplyResult> {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(courtSessions).where(eq(courtSessions.id, sessionId)).for('update')
    if (!s) throw notFound('Courtroom session not found')

    if (input.baseVersion !== s.version) return { kind: 'conflict', session: s }

    let target: CorrectionTarget | undefined
    if (input.type === 'correction') {
      if (!input.correctsEventId) return { kind: 'reject', message: 'Choose the update to undo' }
      const [ev] = await tx
        .select()
        .from(courtEvents)
        .where(and(eq(courtEvents.id, input.correctsEventId), eq(courtEvents.sessionId, sessionId)))
      if (!ev) return { kind: 'reject', message: 'Update not found' }
      target = { ...ev, isLatest: ev.version === s.version }
    }

    const d = decide(s, input, target)
    if (d.kind === 'reject') return d
    if (d.kind === 'noop') return { ...d, session: s }
    if (d.kind === 'confirm') return { ...d, session: s }

    // "Single reporter" = nobody else in this room reported recently. Shown to lawyers only.
    const [others] = await tx
      .select({ n: count() })
      .from(courtSessionMembers)
      .where(
        and(
          eq(courtSessionMembers.sessionId, sessionId),
          ne(courtSessionMembers.userId, reporter.id),
          gt(courtSessionMembers.lastReportedAt, new Date(Date.now() - ACTIVE_REPORTER_MS)),
        ),
      )
    const now = new Date()
    const version = s.version + 1

    const [event] = await tx
      .insert(courtEvents)
      .values({
        sessionId,
        version,
        type: input.type,
        item: input.type === 'correction' ? null : (input.item ?? null),
        reporterId: reporter.id,
        officeId: reporter.officeId,
        singleReporter: others.n === 0,
        confirmed: d.confirmed,
        correctsEventId: target ? input.correctsEventId : null,
        prevCurrentItem: s.currentItem,
        prevHearingItem: s.hearingItem,
        prevStatus: s.status,
        createdAt: now,
      })
      .returning()

    const [session] = await tx
      .update(courtSessions)
      .set({ ...d.next, version, lastEventAt: now })
      .where(and(eq(courtSessions.id, sessionId), eq(courtSessions.version, s.version)))
      .returning()

    await tx
      .insert(courtSessionMembers)
      .values({ sessionId, userId: reporter.id, lastReportedAt: now })
      .onConflictDoUpdate({
        target: [courtSessionMembers.sessionId, courtSessionMembers.userId],
        set: { lastReportedAt: now },
      })

    return { kind: 'applied', session, event }
  })
}

/** Sessions shown on a staff member's day view: rooms with their office's cases + rooms they joined. */
export async function sessionsForUser(user: User, date: string) {
  const officeRooms = user.officeId
    ? await db
        .selectDistinct({ courtroomId: cases.courtroomId })
        .from(cases)
        .where(and(eq(cases.officeId, user.officeId), eq(cases.hearingDate, date)))
    : []

  for (const { courtroomId } of officeRooms) {
    const s = await getOrCreateSession(courtroomId, date)
    await joinSession(s.id, user.id)
  }

  const joined = await db
    .select({ id: courtSessions.id })
    .from(courtSessionMembers)
    .innerJoin(courtSessions, eq(courtSessions.id, courtSessionMembers.sessionId))
    .where(and(eq(courtSessionMembers.userId, user.id), eq(courtSessions.date, date)))
  if (!joined.length) return []

  return db
    .select({ session: courtSessions, courtroom: courtrooms })
    .from(courtSessions)
    .innerJoin(courtrooms, eq(courtrooms.id, courtSessions.courtroomId))
    .where(inArray(courtSessions.id, joined.map((j) => j.id)))
    .orderBy(asc(courtrooms.courtComplex), asc(courtrooms.roomNo))
}
