import { BellOff, BellRing, Briefcase, CalendarDays, Compass, Hash, History, Info, Landmark, LogOut, MessageCircle, RefreshCw, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatPanel } from '../../components/ChatPanel'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { useTour } from '../../components/Tour'
import { Logo } from '../../components/Logo'
import { Badge, Banner, Button, Card, PageSpinner, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { EVENT_META, clockTime, statusMeta, timeAgo, useNow, usePolling, type EventType, type SessionState } from '../../lib/court'
import { formatDate } from '../../lib/dates'
import { MSG_ALERT, startChat, stopChat, useChat, useIncomingMessages, type Message } from '../../lib/nexconn'
import { pushState, turnOffPush, turnOnPush, type PushState } from '../../lib/push'
import { clientTourSteps } from '../../lib/tourSteps'

interface ClientView {
  kind: 'client' | 'family'
  clientName: string
  firmName: string
  case: { title: string; caseNo: string | null; itemNo: number; hearingDate: string; courtComplex: string; roomNo: string }
  isToday: boolean
  session: SessionState | null
  updates: { type: EventType; item: number | null; at: string }[]
  alerts: { message: string; at: string }[]
  linkId: string
  caseId: string
  today: string
  history: { date: string; message: string; at: string }[]
  cases: { id: string; title: string; caseNo: string | null; hearingDate: string; itemNo: number; courtComplex: string; roomNo: string; current: boolean }[]
}

/** The client's page: their own cases only. No app, no password: opened from a WhatsApp link. */
export default function ClientCase() {
  const [data, setData] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const now = useNow()
  // ?case=<id> shows another case of the same client.
  const [params, setParams] = useSearchParams()
  const caseParam = params.get('case')

  const load = useCallback(async () => {
    if (signedOut) return
    try {
      setData(await api<ClientView>(caseParam ? `/c/me?case=${encodeURIComponent(caseParam)}` : '/c/me'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your case')
    }
  }, [caseParam, signedOut])
  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 10000)

  // First visit on this phone: guided tour of the page.
  const tour = useTour()
  const tourKey = data ? `cc-tour-done:client:${data.linkId}` : null
  const firstName = data?.clientName.split(' ')[0] ?? ''
  const kind = data?.kind
  const startTour = useCallback(() => {
    if (!tourKey || !kind) return
    tour.start(clientTourSteps(firstName, kind), () => {
      try {
        localStorage.setItem(tourKey, '1')
      } catch {
        /* ignore */
      }
    })
  }, [tour, tourKey, firstName, kind])
  useEffect(() => {
    if (!tourKey) return
    let seen = true
    try {
      seen = localStorage.getItem(tourKey) === '1'
    } catch {
      /* storage blocked: skip the automatic tour */
    }
    if (seen) return
    const t = setTimeout(startTour, 900)
    return () => clearTimeout(t)
    // Only once per link, when the page first has data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey])

  async function signOut() {
    // Stop alerts to this phone too, then forget the client session.
    await turnOffPush().catch(() => {})
    await stopChat()
    await api('/c/signout', { method: 'POST' })
    setSignedOut(true)
    setData(null)
  }

  // Alerts arrive instantly over Nexconn (client links): show them and refresh the page.
  const [flash, setFlash] = useState<string | null>(null)
  const onIncoming = useCallback(
    (m: Message) => {
      if (m.messageType !== MSG_ALERT) return
      setFlash((m.content as { text?: string }).text ?? 'New update on your case')
      load()
    },
    [load],
  )
  useIncomingMessages(onIncoming)

  if (signedOut) {
    return (
      <Shell>
        <Card className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-base">
            <LogOut className="size-7" strokeWidth={1.75} />
          </span>
          <p className="text-h2">You're signed out on this phone</p>
          <p className="text-label text-ink-muted">
            To see your case again, open the link your lawyer sent you on WhatsApp. Alerts to this phone are off.
          </p>
        </Card>
      </Shell>
    )
  }
  if (error && !data) {
    return (
      <Shell>
        <Banner tone="stopped">{error}</Banner>
        {caseParam && (
          <Button variant="secondary" onClick={() => setParams({})}>
            Back to my case
          </Button>
        )}
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
  if (c.hearingDate < data.today) headline = `This hearing was on ${formatDate(c.hearingDate)}. See what happened under History.`
  else if (!data.isToday) headline = `Next hearing on ${formatDate(c.hearingDate)}. Live progress appears here on the day.`
  else if (!s || current == null) headline = 'No courtroom updates yet today. This page updates by itself.'
  else if (s.status === 'not_sitting') headline = 'The court is not sitting today. Your lawyer will update you.'
  else if (s.status === 'risen') headline = 'The court has risen for the day. Your lawyer will update you.'
  else if (recalled && s.hearingItem === c.itemNo) headline = 'Your case has been recalled and is being heard now.'
  else if (away! > 0) headline = `${away} ${away === 1 ? 'case' : 'cases'} before yours.`
  else if (away === 0) headline = 'Your case is being heard now.'
  else headline = 'Progress has moved past your item. Your lawyer will update you.'

  return (
    <Shell firm={data.firmName} onTour={startTour} onSignOut={() => setConfirmSignOut(true)}>
      <ConfirmSheet
        open={confirmSignOut}
        title="Sign out of this phone?"
        message="Your case and alerts will stop showing here. To come back, open the link your lawyer sent you on WhatsApp."
        confirmLabel="Sign out"
        tone="primary"
        confirmIcon={<LogOut className="size-5" strokeWidth={1.75} />}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={signOut}
      />
      <p className="text-label text-ink-muted">Namaste {data.clientName.split(' ')[0]}, this is your case</p>
      {flash && (
        <button onClick={() => setFlash(null)} className="cc-pop w-full text-left" aria-label="Dismiss alert">
          <Banner tone="info">
            <span className="flex items-start gap-2">
              <BellRing className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} /> {flash}
            </span>
          </Banner>
        </button>
      )}
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
          <Card data-tour="client-progress" className="border-2 border-accent/40">
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
            <Card data-tour="client-updates">
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

          <CaseHistory data={data} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <AlertsCard />
          {data.kind === 'client' ? (
            <ClientChat firm={data.firmName} />
          ) : (
            <Card className="flex items-start gap-3">
              <Users className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
              <p className="text-label">This is a family link: it shows progress only. Only the client can chat with the lawyer.</p>
            </Card>
          )}
          {data.cases.length > 1 && <YourCases data={data} onPick={(id) => setParams({ case: id })} />}
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

/** Phone notifications: one tap to get alerts even when this page is closed. */
function AlertsCard() {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    pushState()
      .then(setState)
      .catch(() => setState('unsupported'))
  }, [])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      setState(state === 'on' ? await turnOffPush() : await turnOnPush())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Alerts could not be turned on')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null
  return (
    <Card data-tour="client-alerts" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-md', state === 'on' ? 'bg-hearing-bg text-hearing-fg' : 'bg-base')}>
          {state === 'on' ? <BellRing className="size-5" strokeWidth={1.75} /> : <BellOff className="size-5" strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold">{state === 'on' ? 'Alerts are on' : 'Get alerts on this phone'}</p>
          <p className="text-caption text-ink-muted">
            {state === 'unsupported'
              ? "This browser can't show alerts. Keep this page open, or on iPhone add it to your Home Screen first."
              : state === 'blocked'
                ? 'Alerts are blocked. Allow notifications for this site in your browser settings.'
                : 'When the court is 10, 5 and 2 cases away, when your case is heard, passed over or adjourned.'}
          </p>
        </div>
        {(state === 'on' || state === 'off') && (
          <Button size="sm" variant={state === 'on' ? 'secondary' : 'primary'} loading={busy} onClick={toggle}>
            {state === 'on' ? 'Turn off' : 'Turn on'}
          </Button>
        )}
      </div>
      {error && <p className="text-caption text-stopped-fg">{error}</p>}
    </Card>
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
    <section data-tour="client-chat" aria-label="Chat with your lawyer" className="flex flex-col gap-2">
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

/** The client's other cases with this firm: today, upcoming and past. Tap to switch. */
function YourCases({ data, onPick }: { data: ClientView; onPick: (id: string) => void }) {
  return (
    <Card data-tour="client-cases">
      <p className="mb-2 flex items-center gap-2 text-h2">
        <Briefcase className="size-5" strokeWidth={1.75} /> Your cases
      </p>
      <ul className="flex flex-col gap-2">
        {data.cases.map((k) => {
          const when = k.hearingDate === data.today ? 'today' : k.hearingDate > data.today ? 'upcoming' : 'past'
          return (
            <li key={k.id}>
              <button
                onClick={() => onPick(k.id)}
                aria-current={k.current}
                className={cx(
                  'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors',
                  k.current ? 'border-accent bg-surface-raised ring-2 ring-accent/30' : 'border-line hover:border-accent',
                )}
              >
                <span className="tabular flex h-10 min-w-11 shrink-0 items-center justify-center rounded-sm bg-accent px-2 text-label font-bold text-accent-ink">
                  {k.itemNo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label font-semibold">{k.title}</span>
                  <span className="block truncate text-caption text-ink-muted">
                    {k.courtComplex} · Court {k.roomNo} · {formatDate(k.hearingDate)}
                  </span>
                </span>
                <Badge tone={when === 'today' ? 'hearing' : when === 'upcoming' ? 'info' : 'stale'}>
                  {when === 'today' ? 'Today' : when === 'upcoming' ? 'Upcoming' : 'Past'}
                </Badge>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Earlier court days for the case being viewed: every alert, grouped by date (newest first). */
function CaseHistory({ data }: { data: ClientView }) {
  const earlier = data.history.filter((h) => h.date !== data.today)
  const byDate = new Map<string, typeof earlier>()
  for (const h of earlier) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h])
  return (
    <Card data-tour="client-history">
      <p className="mb-2 flex items-center gap-2 text-h2">
        <History className="size-5" strokeWidth={1.75} /> History
      </p>
      {byDate.size === 0 ? (
        <p className="text-label text-ink-muted">Earlier court days for this case will appear here.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {[...byDate.entries()].map(([date, items]) => (
            <li key={date}>
              <p className="mb-1 text-label font-semibold">{formatDate(date)}</p>
              <ul className="flex flex-col gap-1.5 border-l-2 border-line pl-3">
                {[...items].reverse().map((h) => (
                  <li key={h.at + h.message} className="flex items-start gap-2 text-label">
                    <span className="flex-1">{h.message}</span>
                    <span className="shrink-0 text-caption text-ink-muted">{clockTime(h.at)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function Shell({
  children,
  firm,
  onTour,
  onSignOut,
}: {
  children: React.ReactNode
  firm?: string
  onTour?: () => void
  onSignOut?: () => void
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex min-w-0 items-center gap-1">
            {firm && <span className="mr-1 hidden truncate text-label text-ink-muted sm:inline">{firm}</span>}
            {onTour && onSignOut && (
              <div data-tour="client-menu" className="flex items-center gap-1">
                <button
                  onClick={onTour}
                  aria-label="Take the tour"
                  className="flex h-10 items-center gap-1.5 rounded-md px-2.5 text-label font-semibold hover:bg-surface-raised"
                >
                  <Compass className="size-5" strokeWidth={1.75} /> <span className="hidden min-[400px]:inline">Tour</span>
                </button>
                <button
                  onClick={onSignOut}
                  aria-label="Sign out"
                  className="flex h-10 items-center gap-1.5 rounded-md px-2.5 text-label font-semibold hover:bg-surface-raised"
                >
                  <LogOut className="size-5" strokeWidth={1.75} /> <span className="hidden min-[400px]:inline">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-5">{children}</main>
    </div>
  )
}
