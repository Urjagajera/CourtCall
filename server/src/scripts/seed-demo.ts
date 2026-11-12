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
import { ALERT_TEXT } from '../lib/alertText.js'
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
  const owner = await user(ownerEmail, ownerName, 'lawyer', null, { isFirmAdmin: true })
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
const juniorB = await user(acc('junior2').email, acc('junior2').name, 'junior', b.officeId)
const anil = await user(acc('lawyer3').email, acc('lawyer3').name, 'lawyer', a.officeId)
const neha = await user(acc('staff').email, acc('staff').name, 'staff', a.officeId)

const court4 = await upsertCourtroom(COMPLEX, '4')
const court7 = await upsertCourtroom(COMPLEX, '7')

// Demo client opens in English (judges); the EN / हिं / ગુ switch on his page shows the other languages.
const ramesh = await client(a.officeId, 'Ramesh Patel', 'en')
await db.update(schema.clients).set({ language: 'en' }).where(eq(schema.clients.id, ramesh.id))
const sunita = await client(a.officeId, 'Sunita Joshi', 'hi')
const kiran = await client(b.officeId, 'Kiran Desai', 'en')

// Fresh cases for today (old demo cases for these offices are replaced, with their updates).
await db.delete(schema.notifications).where(inArray(schema.notifications.userId, [a.owner.id, b.owner.id, anil.id, neha.id, juniorA.id, juniorB.id]))
await db.delete(schema.cases).where(inArray(schema.cases.officeId, [a.officeId, b.officeId]))
const seededCases = await db.insert(schema.cases).values([
  { officeId: a.officeId, clientId: ramesh.id, title: 'Patel vs State of Gujarat', caseNo: 'CR.MA/1452/2026', courtroomId: court4.id, hearingDate: today, itemNo: 15, mainLawyerId: anil.id, assignedJuniorId: juniorA.id, helperStaffId: neha.id },
  { officeId: a.officeId, clientId: sunita.id, title: 'Joshi vs Joshi', caseNo: 'FA/388/2025', courtroomId: court4.id, hearingDate: today, itemNo: 22, mainLawyerId: a.owner.id, assignedJuniorId: juniorA.id, helperStaffId: neha.id },
  { officeId: a.officeId, clientId: ramesh.id, title: 'Patel Textiles vs GSFC', caseNo: 'SCA/9021/2026', courtroomId: court7.id, hearingDate: today, itemNo: 9, mainLawyerId: anil.id, helperStaffId: neha.id },
  { officeId: b.officeId, clientId: kiran.id, title: 'Desai vs Municipal Corporation', caseNo: 'SCA/7710/2026', courtroomId: court4.id, hearingDate: today, itemNo: 18, mainLawyerId: b.owner.id, assignedJuniorId: juniorB.id },
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
  .values({ officeId: a.officeId, clientId: ramesh.id, title: 'Patel vs Shah (property)', caseNo: 'CS/220/2025', courtroomId: cityCivil12.id, hearingDate: daysAgo(21), itemNo: 31, mainLawyerId: anil.id })
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
// Same wording as real alerts, in the client's language.
const T = ALERT_TEXT.en
const v4 = (cur: number) => ({ court: '4', mine: 11, cur, away: 11 - cur })
const v12 = (cur: number) => ({ court: '12', mine: 31, cur, away: 31 - cur })
await pastDay(court4.id, daysAgo(7), patelMain.id, [
  ['first', T.first(v4(2)), 2],
  ['within_5', T.within(v4(6)), 31],
  ['within_2', T.close(v4(9)), 48],
  ['now_hearing', T.now_hearing(v4(11)), 57],
  ['adjourned', T.adjourned(v4(11)), 59],
])
await pastDay(cityCivil12.id, daysAgo(21), oldCase.id, [
  ['within_10', T.within(v12(22)), 10],
  ['within_2', T.close(v12(29)), 40],
  ['now_hearing', T.now_hearing(v12(31)), 52],
])

// Recorded hearing outcomes: last week's hearing of the main case (adjourned to today), the old case closed.
const mehtaId = (await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, acc('lawyer').email)))[0].id
await db.insert(schema.caseHearings).values([
  {
    caseId: patelMain.id,
    date: daysAgo(7),
    courtroomId: court4.id,
    itemNo: 11,
    outcome: 'next_date',
    nextDate: today,
    summary: 'Arguments on bail were heard in part. The State asked for time to file its reply. Adjourned to the next date.',
    shareWithClient: true,
    prepNotes: 'Collect the State reply copy. Keep the surety documents and the medical certificate ready. Client to be present.',
    recordedBy: mehtaId,
  },
  {
    caseId: oldCase.id,
    date: daysAgo(21),
    courtroomId: cityCivil12.id,
    itemNo: 31,
    outcome: 'closed',
    summary: 'Final arguments completed and the suit was decreed in our favour. The certified copy will be applied for.',
    shareWithClient: true,
    prepNotes: 'Apply for the certified copy of the decree. Check the limitation for execution.',
    recordedBy: mehtaId,
  },
])
await db.update(schema.cases).set({ status: 'closed' }).where(eq(schema.cases.id, oldCase.id))
// A hearing two days ago with no outcome yet: shows the "Hearings to update" reminder (Mehta and Neha).
await db.insert(schema.cases).values({ officeId: a.officeId, clientId: sunita.id, title: 'Joshi vs Joshi (maintenance)', caseNo: 'CRMA/77/2026', courtroomId: court7.id, hearingDate: daysAgo(2), itemNo: 6, mainLawyerId: a.owner.id, helperStaffId: neha.id })

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
