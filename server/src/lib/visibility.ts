// Who can see which clients inside a firm.
// - Firm admins: every client of the firm.
// - Juniors: every case of the firm (they cover the courtrooms), but never the Clients page.
// - Other senior lawyers and office staff: only clients assigned to them (client_assignments).
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { User } from '../db/schema.js'

/** null = no restriction (whole firm); otherwise the client IDs this person may see. */
export async function clientScope(u: User): Promise<string[] | null> {
  if (u.isFirmAdmin || u.role === 'junior') return null
  const rows = await db
    .select({ id: schema.clientAssignments.clientId })
    .from(schema.clientAssignments)
    .where(eq(schema.clientAssignments.userId, u.id))
  return rows.map((r) => r.id)
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

/** Adds people (from the same firm, lawyers or staff) to a client. Others are ignored. */
export async function assignClient(clientId: string, officeId: string, userIds: string[]) {
  if (!userIds.length) return
  const valid = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.id, userIds),
        eq(schema.users.officeId, officeId),
        inArray(schema.users.role, ['lawyer', 'staff']),
      ),
    )
  if (!valid.length) return
  await db
    .insert(schema.clientAssignments)
    .values(valid.map((v) => ({ clientId, userId: v.id })))
    .onConflictDoNothing()
}
