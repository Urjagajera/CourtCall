import { BellRing, CalendarDays, Hash, Info, Landmark, MessageCircle, RefreshCw, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ChatPanel } from '../../components/ChatPanel'
import { Logo } from '../../components/Logo'
import { Badge, Banner, Card, PageSpinner, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { EVENT_META, clockTime, statusMeta, timeAgo, useNow, usePolling, type EventType, type SessionState } from '../../lib/court'
import { formatDate } from '../../lib/dates'
import { startChat, stopChat, useChat } from '../../lib/nexconn'

interface ClientView {
  kind: 'client' | 'family'
  clientName: string
  firmName: string
  case: { title: string; caseNo: string | null; itemNo: number; hearingDate: string; courtComplex: string; roomNo: string }
  isToday: boolean
  session: SessionState | null
  updates: { type: EventType; item: number | null; at: string }[]
  alerts: { message: string; at: string }[]
}

/** The client's page: their own case only. No app, no password: opened from a WhatsApp link. */
export default function ClientCase() {
  const [data, setData] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow()

  const load = useCallback(async () => {
    try {
      setData(await api<ClientView>('/c/me'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your case')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 10000)

  if (error && !data) {
    return (
      <Shell>
        <Banner tone="stopped">{error}</Banner>
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell>
        <PageSpinner />
      </Shell>
    )
  }

  const c = data.case
  const s = data.session
  const current = s?.currentItem ?? null
  const away = current != null ? c.itemNo - current : null
  const st = s ? statusMeta(s) : null
  const recalled = s && s.hearingItem != null && s.currentItem != null && s.hearingItem !== s.currentItem

  let headline: string
  if (!data.isToday) headline = `Hearing on ${formatDate(c.hearingDate)}. Live progress appears here on the day.`
  else if (!s || current == null) headline = 'No courtroom updates yet today. This page updates by itself.'
  else if (s.status === 'not_sitting') headline = 'The court is not sitting today. Your lawyer will update you.'
  else if (s.status === 'risen') headline = 'The court has risen for the day. Your lawyer will update you.'
  else if (recalled && s.hearingItem === c.itemNo) headline = 'Your case has been recalled and is being heard now.'
  else if (away! > 0) headline = `${away} ${away === 1 ? 'case' : 'cases'} before yours.`
  else if (away === 0) headline = 'Your case is being heard now.'
  else headline = 'Progress has moved past your item. Your lawyer will update you.'

  return (
    <Shell firm={data.firmName}>
      <p className="text-label text-ink-muted">Namaste {data.clientName.split(' ')[0]}, this is your case</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <p className="text-h2">{c.title}</p>
            <ul className="mt-2 flex flex-col gap-1 text-label text-ink-muted">
              {c.caseNo && (
                <li className="flex items-center gap-1.5">
                  <Hash className="size-4" strokeWidth={1.75} /> {c.caseNo}
                </li>
              )}
              <li className="flex items-center gap-1.5">
                <Landmark className="size-4 text-detail" strokeWidth={1.75} /> {c.courtComplex} · Court {c.roomNo}
              </li>
              <li className="flex items-center gap-1.5">
                <CalendarDays className="size-4" strokeWidth={1.75} /> {data.isToday ? 'Today' : formatDate(c.hearingDate)}
              </li>
            </ul>
          </Card>

          {/* Live progress */}
          <Card className="border-2 border-accent/40">
            <div className="flex items-center justify-between gap-2">
              <p className="text-label font-semibold">Court {c.roomNo} progress</p>
              {st && (
                <Badge tone={st.tone} icon={<st.icon className="size-3.5" strokeWidth={1.75} />}>
                  {st.label}
                </Badge>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md bg-base p-3">
                <p className="text-caption text-ink-muted">Now</p>
                <p key={current ?? 'none'} className="cc-flip tabular text-[2.75rem] font-bold leading-none">
                  {current ?? '—'}
                </p>
              </div>
              <div className="rounded-md bg-accent p-3 text-accent-ink">
                <p className="text-caption opacity-90">Your item</p>
                <p className="tabular text-[2.75rem] font-bold leading-none">{c.itemNo}</p>
              </div>
            </div>
            {current != null && (
              <div className="mt-3 h-2 rounded-full bg-line" aria-hidden="true">
                <div
                  className="h-2 rounded-full bg-detail transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(4, (current / c.itemNo) * 100))}%` }}
                />
              </div>
            )}
            <p className="mt-3 text-body font-semibold" aria-live="polite">
              {headline}
            </p>
            {recalled && s.hearingItem !== c.itemNo && (
              <p className="mt-1 text-label text-waiting-fg">Item {s.hearingItem} was recalled and is being heard.</p>
            )}
            {s?.lastEventAt && (
              <p className={cx('mt-1 text-caption', s.stale ? 'font-semibold text-stale-fg' : 'text-ink-muted')}>
                Reported {timeAgo(s.lastEventAt, now)}
                {s.stale && ' · may be out of date'}
              </p>
            )}
          </Card>

          {(data.updates.length > 0 || data.alerts.length > 0) && (
            <Card>
              <p className="mb-2 flex items-center gap-2 text-h2">
                <RefreshCw className="size-5" strokeWidth={1.75} /> Latest updates
              </p>
              <ul className="divide-y divide-line">
                {data.alerts.slice(0, 5).map((a) => (
                  <li key={'a' + a.at} className="flex items-start gap-2 py-2 text-label">
                    <BellRing className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
                    <span className="flex-1">{a.message}</span>
                    <span className="text-caption text-ink-muted">{clockTime(a.at)}</span>
                  </li>
                ))}
                {data.updates.map((u) => {
                  const m = EVENT_META[u.type]
                  return (
                    <li key={u.at + u.type} className="flex items-center gap-2 py-2 text-label">
                      <m.icon className="size-4 shrink-0" strokeWidth={1.75} />
                      <span className="flex-1">
                        {m.label}
                        {u.item != null && ` · Item ${u.item}`}
                      </span>
                      <span className="text-caption text-ink-muted">{clockTime(u.at)}</span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {data.kind === 'client' ? (
            <ClientChat firm={data.firmName} />
          ) : (
            <Card className="flex items-start gap-3">
              <Users className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
              <p className="text-label">This is a family link: it shows progress only. Only the client can chat with the lawyer.</p>
            </Card>
          )}
          <p className="flex items-start gap-2 text-caption text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
            CourtCall shows the latest progress reported by verified lawyers in the courtroom. It does not predict hearing times.
            This page works only on this phone.
          </p>
        </div>
      </div>
    </Shell>
  )
}

/** Private chat with the firm through Nexconn (the client is user c<clientId>). */
function ClientChat({ firm }: { firm: string }) {
  const chat = useChat()
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // A staff session in the same browser must not be reused as the client's identity.
      if (chat.myId && !chat.myId.startsWith('c')) await stopChat()
      if (!cancelled) await startChat('/c/chat-token')
    })()
    return () => {
      cancelled = true
    }
    // Connect once for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contacts = chat.myId?.startsWith('c') ? chat.contacts : []
  const active = selected ?? contacts[0]?.ncId ?? null
  const names = Object.fromEntries(contacts.map((p) => [p.ncId, p.name]))

  return (
    <section aria-label="Chat with your lawyer" className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-h2">
        <MessageCircle className="size-5" strokeWidth={1.75} /> Chat with {firm}
      </p>
      {contacts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {contacts.map((p) => (
            <button
              key={p.ncId}
              onClick={() => setSelected(p.ncId)}
              aria-pressed={active === p.ncId}
              className={cx(
                'rounded-full border px-3 py-1 text-caption font-semibold',
                active === p.ncId ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <ChatPanel
        key={active ?? 'none'}
        kind="direct"
        channelId={active}
        names={names}
        placeholder={active ? `Message ${names[active] ?? 'your lawyer'}` : 'Message'}
        className="h-[26rem]"
        emptyText="Ask your lawyer anything about your case."
      />
    </section>
  )
}

function Shell({ children, firm }: { children: React.ReactNode; firm?: string }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-3 px-4">
          <Logo />
          {firm && <span className="truncate text-label text-ink-muted">{firm}</span>}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-5">{children}</main>
    </div>
  )
}
