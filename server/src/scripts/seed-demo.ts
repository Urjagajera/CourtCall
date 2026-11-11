// Usage: npm run seed:demo
// Creates (or refreshes) demo accounts and today's cases for testing and the demo video.
// Two offices share Court 4 to show cross-office courtroom rooms. Re-run daily: case dates move to today.
// The shared demo password is written to server/.demo-credentials.txt (gitignored), never committed.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { eq, inArray } from 'drizzle-orm'
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
  if (owner.officeId) return { owner, officeId: owner.officeId }
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

await user(acc('admin').email, acc('admin').name, 'admin', null)

const a = await office(acc('lawyer').email, acc('lawyer').name, 'Mehta & Associates', 'MEHTA4')
const b = await office(acc('lawyer2').email, acc('lawyer2').name, 'Desai Law Chambers', 'DESAI7')
const juniorA = await user(acc('junior').email, acc('junior').name, 'junior', a.officeId)
await user(acc('junior2').email, acc('junior2').name, 'junior', b.officeId)
await user(acc('lawyer3').email, acc('lawyer3').name, 'lawyer', a.officeId, { barCouncilNo: 'G/2211/2018' })
await user(acc('staff').email, acc('staff').name, 'staff', a.officeId)

const court4 = await upsertCourtroom(COMPLEX, '4')
const court7 = await upsertCourtroom(COMPLEX, '7')

const ramesh = await client(a.officeId, 'Ramesh Patel', 'gu')
const sunita = await client(a.officeId, 'Sunita Joshi', 'hi')
const kiran = await client(b.officeId, 'Kiran Desai', 'en')

// Fresh cases for today (old demo cases for these offices are replaced).
await db.delete(schema.cases).where(inArray(schema.cases.officeId, [a.officeId, b.officeId]))
const seededCases = await db.insert(schema.cases).values([
  { officeId: a.officeId, clientId: ramesh.id, title: 'Patel vs State of Gujarat', caseNo: 'CR.MA/1452/2026', courtroomId: court4.id, hearingDate: today, itemNo: 15, assignedJuniorId: juniorA.id },
  { officeId: a.officeId, clientId: sunita.id, title: 'Joshi vs Joshi', caseNo: 'FA/388/2025', courtroomId: court4.id, hearingDate: today, itemNo: 22, assignedJuniorId: juniorA.id },
  { officeId: a.officeId, clientId: ramesh.id, title: 'Patel Textiles vs GSFC', caseNo: 'SCA/9021/2026', courtroomId: court7.id, hearingDate: today, itemNo: 9 },
  { officeId: b.officeId, clientId: kiran.id, title: 'Desai vs Municipal Corporation', caseNo: 'SCA/7710/2026', courtroomId: court4.id, hearingDate: today, itemNo: 18 },
]).returning()

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
    'admin@courtcall.demo   - CourtCall team (verifies firm founders)',
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
