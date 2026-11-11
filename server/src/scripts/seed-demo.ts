// Usage: npm run seed:demo
// Creates (or refreshes) demo accounts and today's cases for testing and the demo video.
// Two offices share Court 4 to show cross-office courtroom rooms. Re-run daily: case dates move to today.
// The shared demo password is written to server/.demo-credentials.txt (gitignored), never committed.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema, sql } from '../db/index.js'
import { hashPassword } from '../lib/auth.js'
import { DEMO_CLIENT_TOKEN, DEMO_LINK_LABEL, sha256 } from '../lib/clientAccess.js'
import { upsertCourtroom } from '../lib/courtrooms.js'
import { DEMO_ACCOUNTS, type DemoKey } from '../lib/demo.js'
import { courtDate } from '../lib/engine.js'

const acc = (k: DemoKey) => DEMO_ACCOUNTS.find((a) => a.key === k)!

const CRED_FILE = new URL('../../.demo-credentials.txt', import.meta.url)
const password = existsSync(CRED_FILE)
  ? (readFileSync(CRED_FILE, 'utf8').match(/password: (\S+)/)?.[1] ?? '')
  : `Demo-${randomBytes(6).toString('base64url')}`
const passwordHash = await hashPassword(password)
const today = courtDate()
const COMPLEX = 'Gujarat High Court'

type Role = 'lawyer' | 'junior' | 'admin' | 'staff'
async function user(email: string, name: string, role: Role, officeId: string | null, extra: Partial<typeof schema.users.$inferInsert> = {}) {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email))
  if (existing) {
    const [u] = await db
      .update(schema.users)
      .set({ passwordHash, role, verificationStatus: 'verified', officeId: officeId ?? existing.officeId, isFirmAdmin: extra.isFirmAdmin ?? false })
      .where(eq(schema.users.id, existing.id))
      .returning()
    return u
  }
  const [u] = await db
    .insert(schema.users)
    .values({ email, name, role, officeId, passwordHash, verificationStatus: 'verified', phone: '9800000000', ...extra })
    .returning()
  return u
}

async function office(ownerEmail: string, ownerName: string, officeName: string, code: string) {
  const owner = await user(ownerEmail, ownerName, 'lawyer', null, { barCouncilNo: `G/${code}/2015`, isFirmAdmin: true })
  if (owner.officeId) {
    // Restore the demo invite code (a test or a demo may have rotated it).
    await db.update(schema.offices).set({ inviteCode: code }).where(eq(schema.offices.id, owner.officeId))
    return { owner, officeId: owner.officeId }
  }
  const [o] = await db.insert(schema.offices).values({ name: officeName, ownerId: owner.id, inviteCode: code }).returning()
  await db.update(schema.users).set({ officeId: o.id }).where(eq(schema.users.id, owner.id))
  return { owner, officeId: o.id }
}

async function client(officeId: string, name: string, language: 'en' | 'hi' | 'gu') {
  const [existing] = await db.select().from(schema.clients).where(eq(schema.clients.name, name))
  if (existing) return existing
  const [c] = await db.insert(schema.clients).values({ officeId, name, phone: '9811111111', language }).returning()
  return c
}

// The old platform admin demo account is no longer used.
await db.delete(schema.users).where(eq(schema.users.email, 'admin@courtcall.demo'))

const a = await office(acc('lawyer').email, acc('lawyer').name, 'Mehta & Associates', 'MEHTA4')
const b = await office(acc('lawyer2').email, acc('lawyer2').name, 'Desai Law Chambers', 'DESAI7')
const juniorA = await user(acc('junior').email, acc('junior').name, 'junior', a.officeId)
await user(acc('junior2').email, acc('junior2').name, 'junior', b.officeId)
const anil = await user(acc('lawyer3').email, acc('lawyer3').name, 'lawyer', a.officeId, { barCouncilNo: 'G/2211/2018' })
const neha = await user(acc('staff').email, acc('staff').name, 'staff', a.officeId)

const court4 = await upsertCourtroom(COMPLEX, '4')
const court7 = await upsertCourtroom(COMPLEX, '7')

const ramesh = await client(a.officeId, 'Ramesh Patel', 'gu')
const sunita = await client(a.officeId, 'Sunita Joshi', 'hi')
// Who looks after whom (firm admin Mehta sees everyone): Anil + Neha look after Ramesh, Neha alone looks after Sunita.
await db.delete(schema.clientAssignments).where(inArray(schema.clientAssignments.clientId, [ramesh.id, sunita.id]))
await db.insert(schema.clientAssignments).values([
  { clientId: ramesh.id, userId: anil.id },
  { clientId: ramesh.id, userId: neha.id },
  { clientId: sunita.id, userId: neha.id },
])
const kiran = await client(b.officeId, 'Kiran Desai', 'en')

// Fresh cases for today (old demo cases for these offices are replaced).
await db.delete(schema.cases).where(inArray(schema.cases.officeId, [a.officeId, b.officeId]))
const seededCases = await db.insert(schema.cases).values([
  { officeId: a.officeId, clientId: ramesh.id, title: 'Patel vs State of Gujarat', caseNo: 'CR.MA/1452/2026', courtroomId: court4.id, hearingDate: today, itemNo: 15, assignedJuniorId: juniorA.id },
  { officeId: a.officeId, clientId: sunita.id, title: 'Joshi vs Joshi', caseNo: 'FA/388/2025', courtroomId: court4.id, hearingDate: today, itemNo: 22, assignedJuniorId: juniorA.id },
  { officeId: a.officeId, clientId: ramesh.id, title: 'Patel Textiles vs GSFC', caseNo: 'SCA/9021/2026', courtroomId: court7.id, hearingDate: today, itemNo: 9 },
  { officeId: b.officeId, clientId: kiran.id, title: 'Desai vs Municipal Corporation', caseNo: 'SCA/7710/2026', courtroomId: court4.id, hearingDate: today, itemNo: 18 },
]).returning()

// History for the client demo: an earlier hearing of Ramesh's main case (adjourned) and an older, finished case.
const daysAgo = (n: number) => {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const cityCivil12 = await upsertCourtroom('City Civil Court', '12')
const [oldCase] = await db
  .insert(schema.cases)
  .values({ officeId: a.officeId, clientId: ramesh.id, title: 'Patel vs Shah (property)', caseNo: 'CS/220/2025', courtroomId: cityCivil12.id, hearingDate: daysAgo(21), itemNo: 31 })
  .returning()
async function pastDay(courtroomId: string, date: string, caseId: string, alerts: [string, string, number][]) {
  await db.insert(schema.courtSessions).values({ courtroomId, date, currentItem: 40, hearingItem: 40, status: 'risen', version: 20 }).onConflictDoNothing()
  const [s] = await db.select().from(schema.courtSessions).where(and(eq(schema.courtSessions.courtroomId, courtroomId), eq(schema.courtSessions.date, date)))
  await db
    .insert(schema.alertLogs)
    .values(
      alerts.map(([alertKey, message, minute], i) => ({
        caseId,
        sessionId: s.id,
        eventVersion: i + 1,
        alertKey,
        message,
        createdAt: new Date(`${date}T05:${String(minute).padStart(2, '0')}:00Z`), // 10:30 IST onwards
      })),
    )
    .onConflictDoNothing()
}
const patelMain = seededCases.find((c) => c.title === 'Patel vs State of Gujarat')!
await pastDay(court4.id, daysAgo(7), patelMain.id, [
  ['first', 'Court 4 has started. Now: Item 2. Your case is Item 11 (9 away).', 2],
  ['within_5', 'Court 4 is at Item 6. Your case is Item 11 (5 away). Get ready.', 31],
  ['within_2', 'Your case is close: Court 4 is at Item 9, yours is Item 11 (2 away). Be near the courtroom.', 48],
  ['now_hearing', 'Your case (Item 11) is being heard now in Court 4.', 57],
  ['adjourned', 'Your case (Item 11) was adjourned in Court 4. Your lawyer will share the next date.', 59],
])
await pastDay(cityCivil12.id, daysAgo(21), oldCase.id, [
  ['within_10', 'Court 12 is at Item 22. Your case is Item 31 (9 away). Get ready.', 10],
  ['within_2', 'Your case is close: Court 12 is at Item 29, yours is Item 31 (2 away). Be near the courtroom.', 40],
  ['now_hearing', 'Your case (Item 31) is being heard now in Court 12.', 52],
])

// Demo client link for Ramesh Patel's main case: opened by the "Client" demo button (never bound to a phone).
const patelCase = seededCases.find((c) => c.title === 'Patel vs State of Gujarat')!
await db.insert(schema.accessLinks).values({
  caseId: patelCase.id,
  kind: 'client',
  label: DEMO_LINK_LABEL,
  tokenHash: sha256(DEMO_CLIENT_TOKEN),
  createdBy: a.owner.id,
})

writeFileSync(
  CRED_FILE,
  [
    'CourtCall demo accounts (local only, do not commit)',
    `password: ${password}`,
    'mehta@courtcall.demo   - firm admin + senior lawyer, Mehta & Associates (invite code MEHTA4)',
    'anil@courtcall.demo    - senior lawyer, Mehta & Associates',
    'priya@courtcall.demo   - junior, Mehta & Associates',
    'neha@courtcall.demo    - office staff, Mehta & Associates',
    'desai@courtcall.demo   - senior lawyer, Desai Law Chambers (invite code DESAI7)',
    'arjun@courtcall.demo   - junior, Desai Law Chambers',
    '',
  ].join('\n'),
)
console.log(`Demo data ready for ${today}: 2 offices, 3 clients, 4 cases (Court 4 shared). Credentials in server/.demo-credentials.txt`)
await sql.end()
