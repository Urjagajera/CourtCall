// Thin wrapper around the Nexconn Chat SDK: one connection per signed-in user, a fan-out
// message bus for React components, and a connection-status store.
import {
  BaseChannel,
  ChannelType,
  ConnectionStatusHandler,
  DirectChannel,
  GroupChannel,
  LogLevel,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
  type Message,
} from '@nexconn/chat'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from './api'

export const MSG_PROGRESS = 'CC:Progress'
export const MSG_ALERT = 'CC:Alert'
export const MSG_TEXT = 'RC:TxtMsg'

export interface TeamInfo {
  groupId: string
  name: string
  members: { ncId: string; name: string; role: string; isFirmAdmin?: boolean }[]
}
export interface ChatContact {
  ncId: string
  name: string
  role: string
}
interface TokenResponse {
  appKey: string
  userId: string
  token: string
  team?: TeamInfo | null
  /** Client links only: the firm people the client can message. */
  contacts?: ChatContact[]
}

export type ChatState = {
  status: 'idle' | 'connecting' | 'ready' | 'error'
  myId: string | null
  team: TeamInfo | null
  contacts: ChatContact[]
  error?: string
}

let state: ChatState = { status: 'idle', myId: null, team: null, contacts: [] }
const stateSubs = new Set<() => void>()
const setState = (s: Partial<ChatState>) => {
  state = { ...state, ...s }
  stateSubs.forEach((f) => f())
}

const messageSubs = new Set<(m: Message) => void>()
let initializedKey: string | null = null
let starting: Promise<void> | null = null

/** Connects the current browser to Nexconn. `tokenPath` differs for staff vs client links. */
export function startChat(tokenPath = '/chat/token') {
  if (state.status === 'ready' || starting) return starting
  starting = (async () => {
    setState({ status: 'connecting', error: undefined })
    try {
      const t = await api<TokenResponse>(tokenPath, { method: 'POST' })
      if (initializedKey !== t.appKey) {
        // initialize() must run exactly once per page lifecycle.
        NCEngine.initialize({ appKey: t.appKey, logLevel: LogLevel.ERROR })
        NCEngine.registerCustomMessages([
          { messageType: MSG_PROGRESS, isPersisted: true, isCounted: false },
          { messageType: MSG_ALERT, isPersisted: true, isCounted: true },
        ])
        NCEngine.addMessageHandler(
          'courtcall',
          new MessageHandler({
            onMessageReceived({ messages }) {
              for (const m of messages) messageSubs.forEach((f) => f(m))
            },
          }),
        )
        NCEngine.addConnectionStatusHandler(
          'courtcall',
          new ConnectionStatusHandler({
            onConnectionStatusChanged({ status }) {
              // 0 = connected in the engine's enum; anything else is reconnecting/offline.
              if (Number(status) !== 0 && state.status === 'ready') setState({ status: 'connecting' })
              if (Number(status) === 0 && state.myId) setState({ status: 'ready' })
            },
          }),
        )
        initializedKey = t.appKey
      }
      const r = await NCEngine.connect({ token: t.token })
      if (!r.isOk) throw new Error(`Chat connection failed (code ${r.code})`)
      setState({ status: 'ready', myId: r.data?.userId ?? t.userId, team: t.team ?? null, contacts: t.contacts ?? [] })
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : 'Chat unavailable' })
    } finally {
      starting = null
    }
  })()
  return starting
}

export async function stopChat() {
  if (state.status === 'idle') return
  try {
    await NCEngine.disconnect()
  } catch {
    /* already disconnected */
  }
  setState({ status: 'idle', myId: null, team: null, contacts: [] })
}

export function useChat() {
  return useSyncExternalStore(
    (f) => {
      stateSubs.add(f)
      return () => stateSubs.delete(f)
    },
    () => state,
  )
}

/** Subscribe to every incoming Nexconn message while the component is mounted. */
export function useIncomingMessages(fn: (m: Message) => void) {
  useEffect(() => {
    messageSubs.add(fn)
    return () => {
      messageSubs.delete(fn)
    }
  }, [fn])
}

// ---- channels ----

export type ChannelKind = 'group' | 'direct' | 'system'

export function channelFor(kind: ChannelKind, id: string) {
  return kind === 'group' ? new GroupChannel(id) : new DirectChannel(id)
}

export function isFromChannel(m: Message, kind: ChannelKind, id: string) {
  const ci = m.channelIdentifier
  const type = kind === 'group' ? ChannelType.GROUP : kind === 'direct' ? ChannelType.DIRECT : ChannelType.SYSTEM
  return ci.channelType === type && ci.channelId === id
}

export async function loadHistory(kind: ChannelKind, id: string, pageSize = 40) {
  const channel = channelFor(kind, id)
  const q = BaseChannel.createMessagesQuery({ channelIdentifier: channel.identifier, pageSize, isAscending: false })
  const r = await q.loadNextPage()
  if (!r.isOk || !r.data) return []
  return [...r.data.data].reverse()
}

export async function sendText(kind: ChannelKind, id: string, text: string) {
  const r = await channelFor(kind, id).sendMessage(new SendTextMessageParams({ text }))
  if (!r.isOk) throw new Error(`Message not sent (code ${r.code})`)
  return r.data!
}

export function markRead(kind: ChannelKind, id: string) {
  channelFor(kind, id)
    .clearUnreadCount()
    .catch(() => {})
}

/** Unread count per channel id (for badges). */
export function useUnreadCounts(refreshKey: unknown) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const chat = useChat()
  useEffect(() => {
    if (chat.status !== 'ready') return
    let cancelled = false
    BaseChannel.createChannelsQuery({ pageSize: 50 })
      .loadNextPage()
      .then((r) => {
        if (cancelled || !r.isOk || !r.data) return
        const next: Record<string, number> = {}
        for (const c of r.data.data) next[c.channelId] = c.unreadCount
        setCounts(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [chat.status, refreshKey])
  return counts
}

export type { Message }
