import { Loader2, MessageCircle, Send, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENT_META, clockTime, type EventType } from '../lib/court'
import {
  MSG_ALERT,
  MSG_PROGRESS,
  MSG_TEXT,
  isFromChannel,
  loadHistory,
  markRead,
  sendText,
  useChat,
  useIncomingMessages,
  type ChannelKind,
  type Message,
} from '../lib/nexconn'
import { cx } from './ui'

interface Props {
  kind: ChannelKind
  channelId: string | null
  /** Nexconn user id -> display name */
  names: Record<string, string>
  placeholder?: string
  readOnly?: boolean
  className?: string
  emptyText?: string
}

/** Oldest at the top, newest at the bottom, whatever order the server or socket delivers them in. */
const byTime = (list: Message[]) => [...list].sort((a, b) => a.sentTime - b.sentTime)

/** Real-time chat for one Nexconn channel: history, live messages, structured progress cards. */
export function ChatPanel({ kind, channelId, names, placeholder = 'Message', readOnly, className, emptyText = 'No messages yet.' }: Props) {
  const chat = useChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chat.status !== 'ready' || !channelId) return
    let cancelled = false
    setLoading(true)
    loadHistory(kind, channelId)
      .then((h) => !cancelled && setMessages(byTime(h)))
      .catch(() => !cancelled && setError('Could not load messages'))
      .finally(() => !cancelled && setLoading(false))
    markRead(kind, channelId)
    return () => {
      cancelled = true
    }
  }, [chat.status, kind, channelId])

  const onIncoming = useCallback(
    (m: Message) => {
      if (!channelId || !isFromChannel(m, kind, channelId)) return
      setMessages((prev) => (prev.some((p) => p.messageId === m.messageId) ? prev : byTime([...prev, m])))
      markRead(kind, channelId)
    },
    [kind, channelId],
  )
  useIncomingMessages(onIncoming)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !channelId) return
    setSending(true)
    setError(null)
    try {
      const m = await sendText(kind, channelId, t)
      setMessages((prev) => byTime([...prev, m]))
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message not sent')
    } finally {
      setSending(false)
    }
  }

  const offline = chat.status === 'error' || !channelId
  return (
    <div className={cx('flex min-h-0 flex-col rounded-lg border border-line bg-surface', className)}>
      <div ref={listRef} className="flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto p-3" aria-live="polite">
        {offline ? (
          <p className="m-auto flex items-center gap-2 text-label text-ink-muted">
            <WifiOff className="size-4" strokeWidth={1.75} /> {chat.error ?? 'Chat is not available yet for this room.'}
          </p>
        ) : chat.status !== 'ready' || loading ? (
          <Loader2 className="m-auto size-6 animate-spin text-ink-muted" strokeWidth={1.75} aria-label="Loading messages" />
        ) : messages.length === 0 ? (
          <p className="m-auto flex items-center gap-2 text-label text-ink-muted">
            <MessageCircle className="size-4" strokeWidth={1.75} /> {emptyText}
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.messageId || m.sentTime} m={m} mine={m.senderUserId === chat.myId} names={names} />)
        )}
      </div>
      {!readOnly && (
        <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={2000}
            disabled={offline || chat.status !== 'ready'}
            aria-label={placeholder}
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface-raised px-3 text-body outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || chat.status !== 'ready'}
            aria-label="Send"
            className="flex size-11 items-center justify-center rounded-md bg-accent text-accent-ink disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-5 animate-spin" strokeWidth={1.75} /> : <Send className="size-5" strokeWidth={1.75} />}
          </button>
        </form>
      )}
      {error && <p className="px-3 pb-2 text-caption text-stopped-fg">{error}</p>}
    </div>
  )
}

function Bubble({ m, mine, names }: { m: Message; mine: boolean; names: Record<string, string> }) {
  const time = clockTime(new Date(m.sentTime).toISOString())

  if (m.messageType === MSG_PROGRESS) {
    const c = m.content as { type: EventType; item: number | null; reporterName?: string; singleReporter?: boolean }
    const meta = EVENT_META[c.type] ?? EVENT_META.now_hearing
    const tone = {
      hearing: 'bg-hearing-bg text-hearing-fg',
      waiting: 'bg-waiting-bg text-waiting-fg',
      stopped: 'bg-stopped-bg text-stopped-fg',
      stale: 'bg-stale-bg text-stale-fg',
      info: 'bg-info-bg text-info-fg',
    }[meta.tone]
    return (
      <div className="cc-pop mx-auto flex max-w-[90%] items-center gap-2 rounded-full px-3 py-1.5 text-caption" role="note">
        <span className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold', tone)}>
          <meta.icon className="size-3.5" strokeWidth={2} />
          {meta.label}
          {c.item != null && ` · Item ${c.item}`}
        </span>
        <span className="text-ink-muted">
          {c.reporterName} · {time}
        </span>
      </div>
    )
  }

  const text =
    m.messageType === MSG_TEXT
      ? (m.content as { text?: string; content?: string }).text ?? (m.content as { content?: string }).content
      : m.messageType === MSG_ALERT
        ? (m.content as { text?: string }).text
        : null
  if (text == null) return null

  return (
    <div className={cx('cc-pop flex max-w-[85%] flex-col', mine ? 'items-end self-end' : 'items-start self-start')}>
      {!mine && <span className="mb-0.5 px-1 text-caption font-semibold text-ink-muted">{names[m.senderUserId] ?? 'Member'}</span>}
      <div
        className={cx(
          'whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-body',
          mine ? 'rounded-br-sm bg-accent text-accent-ink' : 'rounded-bl-sm border border-line bg-surface-raised text-ink',
        )}
      >
        {text}
      </div>
      <span className="mt-0.5 px-1 text-caption text-ink-muted">{time}</span>
    </div>
  )
}
