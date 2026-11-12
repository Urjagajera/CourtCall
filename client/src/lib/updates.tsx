import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from './api'
import { BOT_ID, MSG_NOTICE, useChat, useIncomingMessages, type Message } from './nexconn'
import { BaseChannel } from '@nexconn/chat'

export interface Update {
  id: string
  caseId: string | null
  kind: 'assigned' | 'unassigned' | 'details_changed' | 'outcome_recorded' | 'notes_edited'
  message: string
  readAt: string | null
  createdAt: string
}

interface UpdatesState {
  items: Update[]
  unread: number
  /** Hearings this person must update (main lawyer / firm admin). */
  todos: number
  /** Unread chat messages across all conversations (not the bot). */
  chatUnread: number
  reload: () => void
  markRead: (by: { ids?: string[]; caseId?: string; all?: boolean }) => Promise<void>
}

const Ctx = createContext<UpdatesState | null>(null)

/**
 * "Something new" for the signed-in person: case updates (sidebar badge on Cases + the Updates list on
 * Today) and the chat unread count (badge on Chat). New updates arrive instantly as a Nexconn CC:Notice
 * ping; polling every 30 s is the fallback.
 */
export function UpdatesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ items: Update[]; unread: number; todos: number }>({ items: [], unread: 0, todos: 0 })
  const [chatUnread, setChatUnread] = useState(0)
  const chat = useChat()
  const { pathname } = useLocation()

  const reload = useCallback(async () => {
    try {
      setData(await api('/notifications'))
    } catch {
      /* keep the last state */
    }
  }, [])

  const reloadChat = useCallback(async () => {
    if (chat.status !== 'ready') return
    try {
      const r = await BaseChannel.createChannelsQuery({ pageSize: 50 }).loadNextPage()
      if (!r.isOk || !r.data) return
      setChatUnread(r.data.data.filter((c) => c.channelId !== BOT_ID).reduce((n, c) => n + (c.unreadCount ?? 0), 0))
    } catch {
      /* ignore */
    }
  }, [chat.status])

  useEffect(() => {
    reload()
    const t = setInterval(reload, 30000)
    return () => clearInterval(t)
  }, [reload])

  // Chat counts change when messages arrive and when a conversation is opened (marked read).
  useEffect(() => {
    reloadChat()
    const t = setInterval(reloadChat, 20000)
    return () => clearInterval(t)
  }, [reloadChat, pathname])

  useIncomingMessages(
    useCallback(
      (m: Message) => {
        if (m.messageType === MSG_NOTICE) reload()
        else setTimeout(reloadChat, 300)
      },
      [reload, reloadChat],
    ),
  )

  const markRead = useCallback(
    async (by: { ids?: string[]; caseId?: string; all?: boolean }) => {
      await api('/notifications/read', { body: by }).catch(() => {})
      await reload()
    },
    [reload],
  )

  const value = useMemo(() => ({ ...data, chatUnread, reload, markRead }), [data, chatUnread, reload, markRead])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUpdates() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUpdates must be used inside UpdatesProvider')
  return v
}
