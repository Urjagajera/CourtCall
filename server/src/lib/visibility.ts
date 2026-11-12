// Who can see and change what inside a firm. Rules agreed with Urja (12 Nov 2026), see CLAUDE.md:
// - Every case has a team: main lawyer (senior or junior), helping junior (senior-led cases only), one staff helper.
// - Firm admins see everything. Everyone else sees only the cases they are on, and the clients of those cases
//   (plus clients they added that have no case yet).
// - Case details and hearing outcomes: firm admin or the main lawyer.
// - Team: firm admin sets everything; a senior main lawyer sets the helping junior and staff helper only.
import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { User } from '../db/schema.js'

const { cases, clients } = schema

/** SQL condition: cases this person is on (undefined = no restriction, firm admin). */
export function caseVisible(u: User): SQL | undefined {
  if (u.isFirmAdmin) return undefined
  return or(eq(cases.mainLawyerId, u.id), eq(cases.assignedJuniorId, u.id), eq(cases.helperStaffId, u.id))
}

/** Client IDs this person may see (null = all clients of the firm). */
export async function clientScope(u: User): Promise<string[] | null> {
  if (u.isFirmAdmin) return null
  const [onCases, added] = await Promise.all([
    db.selectDistinct({ id: cases.clientId }).from(cases).where(and(eq(cases.officeId, u.officeId!), caseVisible(u))),
    // A client someone just added, with no case yet, stays visible to them.
    db
      .select({ id: clients.id })
      .from(clients)
      .leftJoin(cases, eq(cases.clientId, clients.id))
      .where(and(eq(clients.createdBy, u.id), isNull(cases.id))),
  ])
  return [...new Set([...onCases, ...added].map((r) => r.id))]
}

/** SQL condition on a client-id column for this scope (always false for an empty list). */
export function inScope(column: Parameters<typeof inArray>[0], scope: string[] | null): SQL | undefined {
  if (scope === null) return undefined
  return scope.length ? inArray(column, scope) : sql`false`
}

export async function canSeeClient(u: User, clientId: string) {
  const scope = await clientScope(u)
  return scope === null || scope.includes(clientId)
}

type Team = { mainLawyerId: string | null; assignedJuniorId: string | null; helperStaffId: string | null }

/** Case details, hearing outcomes and notes, deleting the case. */
export const canEditCase = (u: User, c: Team) => u.isFirmAdmin || (c.mainLawyerId !== null && c.mainLawyerId === u.id)

/** May change the helping junior and staff helper. Only firm admins change the main lawyer. */
export const canManageTeam = (u: User, c: Team) => u.isFirmAdmin || (u.role === 'lawyer' && c.mainLawyerId === u.id)

/** New cases: firm admins and senior lawyers. New clients: same. */
export const canAddCases = (u: User) => u.role === 'lawyer'

export const teamOf = (c: Team) => [c.mainLawyerId, c.assignedJuniorId, c.helperStaffId].filter((x): x is string => !!x)

/** Verified firm admins of an office (they get outcome notices). */
export async function firmAdminIds(officeId: string) {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.officeId, officeId),
        eq(schema.users.isFirmAdmin, true),
        eq(schema.users.role, 'lawyer'),
        eq(schema.users.verificationStatus, 'verified'),
      ),
    )
  return rows.map((r) => r.id)
}

/** Checks a proposed team against the rules; returns the cleaned team. Throws a plain message on a bad pick. */
export async function validateTeam(officeId: string, team: Team): Promise<Team> {
  const ids = teamOf(team)
  const people = ids.length
    ? await db
        .select({ id: schema.users.id, role: schema.users.role, status: schema.users.verificationStatus, officeId: schema.users.officeId })
        .from(schema.users)
        .where(inArray(schema.users.id, ids))
    : []
  const person = (id: string | null) => (id ? people.find((p) => p.id === id && p.officeId === officeId && p.status === 'verified') : undefined)
  const main = person(team.mainLawyerId)
  if (!main || (main.role !== 'lawyer' && main.role !== 'junior')) throw new Error('The main lawyer must be an approved senior or junior lawyer of your firm')
  if (team.assignedJuniorId) {
    if (main.role !== 'lawyer') throw new Error('A helping junior can only be added when the main lawyer is a senior')
    if (person(team.assignedJuniorId)?.role !== 'junior') throw new Error('The helping junior must be an approved junior of your firm')
  }
  if (team.helperStaffId && person(team.helperStaffId)?.role !== 'staff') throw new Error('The helper must be approved office staff of your firm')
  return team
}
