// "Something new" for people on a case: stored for the Updates list and the sidebar badge, and pinged
// instantly over Nexconn (a CC:Notice bot message that is neither stored nor counted as unread chat).
import { db, schema } from '../db/index.js'
import { MSG_NOTICE, ncStaffId, safely, sendBotDirectMessage } from './nexconn.js'

type Kind = (typeof schema.notificationKind.enumValues)[number]

export async function notify(
  userIds: (string | null | undefined)[],
  n: { caseId: string | null; kind: Kind; message: string; actorId: string | null },
) {
  // Never the person who made the change; never twice.
  const to = [...new Set(userIds.filter((id): id is string => !!id && id !== n.actorId))]
  if (!to.length) return
  await db.insert(schema.notifications).values(to.map((userId) => ({ userId, caseId: n.caseId, kind: n.kind, message: n.message, actorId: n.actorId })))
  await safely('notice ping', () => sendBotDirectMessage(to.map(ncStaffId), MSG_NOTICE, { kind: n.kind, caseId: n.caseId }, undefined, false))
}

