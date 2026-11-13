// Nexconn Chat Server API client. Server-side only: the App Secret never reaches a browser.
// Docs: https://docs.nexconn.ai/platform-chat-api
import { createHash, randomBytes } from 'node:crypto'
import { config, nexconnEnabled } from '../config.js'

// ---- ID mapping (Nexconn IDs: letters and digits only, max 64) ----

const hex = (uuid: string) => uuid.replace(/-/g, '')
/** Lawyers, juniors, admins. */
export const ncStaffId = (userId: string) => `u${hex(userId)}`
/** A client (person) of an office. One identity per client, shared by all their links. */
export const ncClientId = (clientId: string) => `c${hex(clientId)}`
/** Shared courtroom room for one courtroom on one day. */
export const ncSessionGroupId = (sessionId: string) => `s${hex(sessionId)}`
/** Private office team room. */
export const ncOfficeGroupId = (officeId: string) => `o${hex(officeId)}`
/** System sender for progress messages and client alerts. */
export const BOT_ID = 'courtcallbot'
export const BOT_NAME = 'CourtCall'

/** Custom message types (must also be registered in the web SDK). */
export const MSG_PROGRESS = 'CC:Progress'
export const MSG_ALERT = 'CC:Alert'
export const MSG_NOTICE = 'CC:Notice' // badge refresh for staff, not stored
/** Firm alert for the people on a case: client is 2 away, being heard, hearing over. */
export const MSG_STAFF_ALERT = 'CC:StaffAlert'

export class NexconnError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

function sign() {
  const nonce = randomBytes(8).toString('hex').slice(0, 16)
  const timestamp = String(Date.now())
  const signature = createHash('sha1').update(config.nexconn.appSecret + nonce + timestamp).digest('hex')
  return { 'App-Key': config.nexconn.appKey, Nonce: nonce, Timestamp: timestamp, Signature: signature }
}

function backupBase(base: string) {
  // api.sg-light-api.com -> api-b.sg-light-api.com
  return base.replace('://api.', '://api-b.')
}

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  if (!nexconnEnabled) throw new NexconnError(-1, 'Nexconn is not configured')
  const bases = [config.nexconn.apiBase.replace(/\/$/, ''), backupBase(config.nexconn.apiBase.replace(/\/$/, ''))]
  let lastErr: unknown
  for (const base of bases) {
    try {
      const res = await fetch(base + path, {
        method: 'POST',
        headers: { ...sign(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      })
      if (res.status >= 500) {
        lastErr = new NexconnError(res.status, `Nexconn ${path} HTTP ${res.status}`)
        continue // try backup domain
      }
      const data = (await res.json().catch(() => ({}))) as { code?: number; msg?: string; errorMessage?: string; result?: T }
      if (data.code !== 0) {
        throw new NexconnError(data.code ?? res.status, `Nexconn ${path} failed: code ${data.code} ${data.msg ?? data.errorMessage ?? ''}`.trim())
      }
      return data.result as T
    } catch (e) {
      if (e instanceof NexconnError) throw e
      lastErr = e // network error / timeout -> try backup
    }
  }
  throw lastErr
}

// ---- users ----

export async function issueToken(ncUserId: string, name: string) {
  const r = await post<{ userId: string; accessToken: string }>('/v4/auth/access-token/issue', {
    userId: ncUserId,
    name: name.slice(0, 64),
  })
  return r.accessToken
}

let botReady: Promise<unknown> | null = null
/** Registers the bot user once per server instance (issuing a token creates the user). */
export function ensureBot() {
  botReady ??= issueToken(BOT_ID, BOT_NAME).catch((e) => {
    botReady = null
    throw e
  })
  return botReady
}

// ---- groups ----

const GROUP_EXISTS = 25409
const ALREADY_MEMBER = 25412

export async function createGroup(channelId: string, name: string, userIds: string[] = []) {
  await ensureBot()
  try {
    await post('/v4/group-channel/create', {
      channelId,
      name: name.slice(0, 64),
      owner: BOT_ID,
      userIds: userIds.slice(0, 30),
      permissions: { joinPerm: 3, memInvitePerm: 0, removePerm: 0 }, // only the server manages membership
    })
  } catch (e) {
    if (!(e instanceof NexconnError && e.code === GROUP_EXISTS)) throw e
  }
}

export async function joinGroup(channelId: string, userIds: string[]) {
  if (!userIds.length) return
  try {
    await post('/v4/group-channel/join', { channelId, userIds: userIds.slice(0, 100) })
  } catch (e) {
    if (!(e instanceof NexconnError && e.code === ALREADY_MEMBER)) throw e
  }
}

export async function leaveGroup(channelId: string, userIds: string[]) {
  if (!userIds.length) return
  await post('/v4/group-channel/leave', { channelId, userIds })
}

// ---- messages ----

export async function sendGroupMessage(channelId: string, messageType: string, content: unknown, pushContent?: string) {
  await ensureBot()
  await post('/v4/group-channel/message/send', {
    fromUserId: BOT_ID,
    toChannelIds: [channelId],
    messageType,
    content: JSON.stringify(content),
    pushContent,
    shouldPersist: 1,
  })
}

/** Read-only system channel message (used for client alerts). */
export async function sendSystemMessage(toUserIds: string[], messageType: string, content: unknown, pushContent?: string) {
  if (!toUserIds.length) return
  await ensureBot()
  await post('/v4/system-channel/message/send', {
    fromUserId: BOT_ID,
    toUserIds: toUserIds.slice(0, 100),
    messageType,
    content: JSON.stringify(content),
    pushContent,
    shouldPersist: 1,
  })
}

/** One-to-one message from the CourtCall bot (client alerts arrive in the client's own chat list). */
/** `persist: false` sends a signal that isn't stored or counted as unread (e.g. CC:Notice badge refresh). */
export async function sendBotDirectMessage(toUserIds: string[], messageType: string, content: unknown, pushContent?: string, persist = true) {
  if (!toUserIds.length) return
  await ensureBot()
  await post('/v4/direct-channel/message/send', {
    fromUserId: BOT_ID,
    toUserIds: toUserIds.slice(0, 1000),
    messageType,
    content: JSON.stringify(content),
    pushContent,
    shouldPersist: persist ? 1 : 0,
  })
}

/** Never let a chat-service hiccup break the core courtroom flow. */
export async function safely(label: string, fn: () => Promise<unknown>) {
  if (!nexconnEnabled) return
  try {
    await fn()
  } catch (e) {
    console.warn(`[nexconn] ${label}:`, e instanceof Error ? e.message : e)
  }
}
