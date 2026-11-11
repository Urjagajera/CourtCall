import {
  BellOff,
  BellRing,
  Briefcase,
  CalendarDays,
  Compass,
  FolderOpen,
  Hash,
  History,
  Info,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChatPanel } from '../../components/ChatPanel'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { useTour } from '../../components/Tour'
import { Logo } from '../../components/Logo'
import { Badge, Banner, Button, Card, PageSpinner, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { EVENT_META, clockTime, statusMeta, useNow, usePolling, type EventType, type SessionState } from '../../lib/court'
import { ClientLangContext, LANGS, agoIn, dateIn, useClientLang, useClientText, type Lang } from '../../lib/clientI18n'
import { MSG_ALERT, startChat, stopChat, useChat, useIncomingMessages, useUnreadCounts, type Message } from '../../lib/nexconn'
import { pushState, turnOffPush, turnOnPush, type PushState } from '../../lib/push'
import { useTheme, type ThemePref } from '../../lib/theme'
import { clientTourSteps } from '../../lib/tourSteps'

interface ClientView {
  kind: 'client' | 'family'
  clientName: string
  language: Lang
  firmName: string
  case: { title: string; caseNo: string | null; itemNo: number | null; hearingDate: string; courtComplex: string; roomNo: string; status: 'active' | 'closed' }
  /** Recorded hearing outcomes (summary only when the firm shared it). */
  hearings: { date: string; outcome: 'next_date' | 'closed'; nextDate: string | null; summary: string | null }[]
  isToday: boolean
  session: SessionState | null
  updates: { type: EventType; item: number | null; at: string }[]
  alerts: { message: string; at: string }[]
  linkId: string
  caseId: string
  today: string
  history: { date: string; message: string; at: string }[]
  cases: { id: string; title: string; caseNo: string | null; hearingDate: string; itemNo: number | null; status: 'active' | 'closed'; courtComplex: string; roomNo: string; current: boolean }[]
}

const LANG_KEY = 'cc-client-lang'
function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'en' || v === 'hi' || v === 'gu' ? v : null
  } catch {
    return null
  }
}

/** The client's page: their own cases only. No app, no password: opened from a WhatsApp link. */
export default function ClientCase() {
  // Language: what this phone picked, else the client's language from the firm, else English.
  const [picked, setPicked] = useState<Lang | null>(storedLang)
  const [fromFirm, setFromFirm] = useState<Lang>('en')
  const lang = picked ?? fromFirm
  const choose = (l: Lang) => {
    setPicked(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* ignore */
    }
    // Also switches the language of this client's alerts.
    api('/c/language', { body: { language: l } }).catch(() => {})
  }
  return (
    <ClientLangContext.Provider value={lang}>
      <ClientCaseInner lang={lang} onLang={choose} onFirmLang={setFromFirm} />
    </ClientLangContext.Provider>
  )
}

function ClientCaseInner({ lang, onLang, onFirmLang }: { lang: Lang; onLang: (l: Lang) => void; onFirmLang: (l: Lang) => void }) {
  const t = useClientText()
  const [data, setData] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const now = useNow()
  // ?case=<id> shows another case of the same client.
  const [params, setParams] = useSearchParams()
  const caseParam = params.get('case')
  // /case, /case/cases, /case/history, /case/chat, /case/settings
  const { tab: tabParam } = useParams()
  const navigate = useNavigate()

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
  useEffect(() => {
    if (data?.language) onFirmLang(data.language)
  }, [data?.language, onFirmLang])

  // First visit on this phone: guided tour of the page.
  const tour = useTour()
  const tourKey = data ? `cc-tour-done:client:${data.linkId}` : null
  const firstName = data?.clientName.split(' ')[0] ?? ''
  const kind = data?.kind
  const startTour = useCallback(() => {
    if (!tourKey || !kind) return
    tour.start(clientTourSteps(firstName, kind, lang), () => {
      try {
        localStorage.setItem(tourKey, '1')
      } catch {
        /* ignore */
      }
    })
  }, [tour, tourKey, firstName, kind, lang])
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

  // Client links stay connected to Nexconn on every tab, so alerts pop up wherever the client is.
  const chat = useChat()
  const isClientLink = data?.kind === 'client'
  useEffect(() => {
    if (!isClientLink) return
    let cancelled = false
    ;(async () => {
      // A staff session in the same browser must not be reused as the client's identity.
      if (chat.myId && !chat.myId.startsWith('c')) await stopChat()
      if (!cancelled) await startChat('/c/chat-token')
    })()
    return () => {
      cancelled = true
    }
    // Connect once, when we know it's a client link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientLink])

  if (signedOut) {
    return (
      <ClientLayout>
        <Card className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-base">
            <LogOut className="size-7" strokeWidth={1.75} />
          </span>
          <p className="text-h2">{t.signedOut}</p>
          <p className="text-label text-ink-muted">{t.signedOutMsg}</p>
        </Card>
      </ClientLayout>
    )
  }
  if (error && !data) {
    return (
      <ClientLayout>
        <Banner tone="stopped">{error}</Banner>
        {caseParam && (
          <Button variant="secondary" onClick={() => setParams({})}>
            {t.backToCase}
          </Button>
        )}
      </ClientLayout>
    )
  }
  if (!data) {
    return (
      <ClientLayout>
        <PageSpinner />
      </ClientLayout>
    )
  }

  const c = data.case
  const s = data.session
  const current = s?.currentItem ?? null
  const away = current != null && c.itemNo != null ? c.itemNo - current : null
  const st = s ? statusMeta(s) : null
  const recalled = s && s.hearingItem != null && s.currentItem != null && s.hearingItem !== s.currentItem

  let headline: string
  if (c.status === 'closed') headline = t.closed
  else if (c.hearingDate < data.today) headline = t.past(dateIn(lang, c.hearingDate))
  else if (!data.isToday) headline = t.upcoming(dateIn(lang, c.hearingDate))
  else if (!s || current == null || c.itemNo == null) headline = t.noUpdates
  else if (s.status === 'not_sitting') headline = t.notSitting
  else if (s.status === 'risen') headline = t.risen
  else if (recalled && s.hearingItem === c.itemNo) headline = t.recalledYours
  else if (away! > 0) headline = t.before(away!)
  else if (away === 0) headline = t.hearingNow
  else headline = t.movedPast

  const tabs = tabsFor(data.kind)
  const tab = tabs.some((x) => x.key === tabParam) ? tabParam! : 'home'
  const title = tab === 'home' ? t.hello(data.clientName.split(' ')[0]) : tabs.find((x) => x.key === tab)!.label(t)

  return (
    <ClientLayout data={data} tabs={tabs}>
      <ConfirmSheet
        open={confirmSignOut}
        title={t.signOutQ}
        message={t.signOutMsg}
        confirmLabel={t.signOut}
        tone="primary"
        confirmIcon={<LogOut className="size-5" strokeWidth={1.75} />}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={signOut}
      />
      {flash && (
        <button onClick={() => setFlash(null)} className="cc-pop mb-4 w-full text-left" aria-label="Dismiss alert">
          <Banner tone="info">
            <span className="flex items-start gap-2">
              <BellRing className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} /> {flash}
            </span>
          </Banner>
        </button>
      )}
      <PageHeader title={title} subtitle={tab === 'home' ? c.title : data.firmName} />

      {tab === 'home' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Live progress */}
            <Card data-tour="client-progress" className="border-2 border-accent/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label font-semibold">{t.progress(c.roomNo)}</p>
                {st && (
                  <Badge tone={st.tone} icon={<st.icon className="size-3.5" strokeWidth={1.75} />}>
                    {t.status[st.label] ?? st.label}
                  </Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-md bg-base p-3">
                  <p className="text-caption text-ink-muted">{t.now}</p>
                  <p key={current ?? 'none'} className="cc-flip tabular text-[2.75rem] font-bold leading-none">
                    {current ?? '—'}
                  </p>
                </div>
                <div className="rounded-md bg-accent p-3 text-accent-ink">
                  <p className="text-caption opacity-90">{t.yourItem}</p>
                  {c.itemNo != null ? (
                    <p className="tabular text-[2.75rem] font-bold leading-none">{c.itemNo}</p>
                  ) : (
                    <p className="py-2 text-label font-semibold">{t.itemNotOut}</p>
                  )}
                </div>
              </div>
              {current != null && c.itemNo != null && (
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
              {recalled && s.hearingItem !== c.itemNo && <p className="mt-1 text-label text-waiting-fg">{t.recalledOther(s.hearingItem!)}</p>}
              {s?.lastEventAt && (
                <p className={cx('mt-1 text-caption', s.stale ? 'font-semibold text-stale-fg' : 'text-ink-muted')}>
                  {t.reported(agoIn(t, s.lastEventAt, now))}
                  {s.stale && t.maybeOld}
                </p>
              )}
            </Card>

            <Card>
              <p className="text-h2">{c.title}</p>
              <ul className="mt-2 flex flex-col gap-1 text-label text-ink-muted">
                {c.caseNo && (
                  <li className="flex items-center gap-1.5">
                    <Hash className="size-4" strokeWidth={1.75} /> {c.caseNo}
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  <Landmark className="size-4 text-detail" strokeWidth={1.75} /> {c.courtComplex} · {t.court(c.roomNo)}
                </li>
                <li className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" strokeWidth={1.75} />{' '}
                  {c.status === 'closed' ? (
                    t.caseEnded
                  ) : data.isToday ? (
                    t.today
                  ) : c.hearingDate > data.today ? (
                    <b>{t.nextHearing(dateIn(lang, c.hearingDate))}</b>
                  ) : (
                    dateIn(lang, c.hearingDate)
                  )}
                </li>
              </ul>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Card data-tour="client-updates">
              <p className="mb-2 flex items-center gap-2 text-h2">
                <RefreshCw className="size-5" strokeWidth={1.75} /> {t.latest}
              </p>
              {data.updates.length === 0 && data.alerts.length === 0 ? (
                <p className="text-label text-ink-muted">{t.noUpdates}</p>
              ) : (
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
                          {t.events[u.type]}
                          {u.item != null && ` · ${t.item(u.item)}`}
                        </span>
                        <span className="text-caption text-ink-muted">{clockTime(u.at)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
            {data.kind === 'family' && (
              <Card className="flex items-start gap-3">
                <Users className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
                <p className="text-label">{t.family}</p>
              </Card>
            )}
            <p className="flex items-start gap-2 text-caption text-ink-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              {t.disclaimer}
            </p>
          </div>
        </div>
      )}

      {tab === 'cases' && (
        <YourCases
          data={data}
          onPick={(id) => {
            setParams({ case: id })
            navigate({ pathname: '/case', search: `?case=${id}` })
          }}
        />
      )}

      {tab === 'history' && <CaseHistory data={data} />}

      {tab === 'chat' && data.kind === 'client' && <ClientChat firm={data.firmName} />}

      {tab === 'settings' && (
        <div className="flex max-w-2xl flex-col gap-4">
          <Card data-tour="client-language">
            <p className="mb-3 text-h2">{t.language}</p>
            <div role="radiogroup" aria-label={t.language} className="grid grid-cols-3 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  role="radio"
                  aria-checked={lang === l.code}
                  onClick={() => onLang(l.code)}
                  className={cx(
                    'h-12 rounded-md border text-body font-semibold transition-colors',
                    lang === l.code ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:border-accent',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </Card>
          <AlertsCard />
          <ThemeCard />
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-h2">{t.tour}</p>
              <p className="text-label text-ink-muted">{t.tourHint}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={startTour} icon={<Compass className="size-4" strokeWidth={1.75} />}>
              {t.takeTour}
            </Button>
          </Card>
          <Button variant="secondary" onClick={() => setConfirmSignOut(true)} icon={<LogOut className="size-5" strokeWidth={1.75} />}>
            {t.signOut}
          </Button>
          <p className="flex items-start gap-2 text-caption text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
            {t.disclaimer}
          </p>
        </div>
      )}
    </ClientLayout>
  )
}

/** Phone notifications: one tap to get alerts even when this page is closed. */
function AlertsCard() {
  const t = useClientText()
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
          <p className="text-label font-semibold">{state === 'on' ? t.alertsOn : t.getAlerts}</p>
          <p className="text-caption text-ink-muted">
            {state === 'unsupported'
              ? t.alertsUnsupported
              : state === 'blocked'
                ? t.alertsBlocked
                : t.alertsWhen}
          </p>
        </div>
        {(state === 'on' || state === 'off') && (
          <Button size="sm" variant={state === 'on' ? 'secondary' : 'primary'} loading={busy} onClick={toggle}>
            {state === 'on' ? t.turnOff : t.turnOn}
          </Button>
        )}
      </div>
      {error && <p className="text-caption text-stopped-fg">{error}</p>}
    </Card>
  )
}

/** Private chat with the firm through Nexconn (the client is user c<clientId>). */
function ClientChat({ firm }: { firm: string }) {
  const t = useClientText()
  const voiceLang = useClientLang().speech
  const chat = useChat()
  const [selected, setSelected] = useState<string | null>(null)

  const contacts = chat.myId?.startsWith('c') ? chat.contacts : []
  const active = selected ?? contacts[0]?.ncId ?? null
  const names = Object.fromEntries(contacts.map((p) => [p.ncId, p.name]))

  return (
    <section data-tour="client-chat" aria-label="Chat with your lawyer" className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-label text-ink-muted">
        <MessageCircle className="size-4" strokeWidth={1.75} /> {t.chatWith(firm)}
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
        placeholder={t.message(active ? (names[active] ?? firm) : firm)}
        voiceLang={voiceLang}
        className="h-[calc(100dvh-17rem)] min-h-[22rem] lg:h-[calc(100dvh-14rem)]"
        emptyText={t.chatEmpty}
      />
    </section>
  )
}

/** The client's other cases with this firm: today, upcoming and past. Tap to switch. */
function YourCases({ data, onPick }: { data: ClientView; onPick: (id: string) => void }) {
  const t = useClientText()
  const lang = useClientLang().code
  return (
    <Card data-tour="client-cases">
      <p className="mb-2 flex items-center gap-2 text-h2">
        <Briefcase className="size-5" strokeWidth={1.75} /> {t.yourCases}
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
                    {k.courtComplex} · {t.court(k.roomNo)} · {dateIn(lang, k.hearingDate)}
                  </span>
                </span>
                <Badge tone={k.status === 'closed' ? 'stale' : when === 'today' ? 'hearing' : when === 'upcoming' ? 'info' : 'stale'}>
                  {k.status === 'closed' ? t.caseClosed : when === 'today' ? t.caseToday : when === 'upcoming' ? t.caseUpcoming : t.casePast}
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
  const t = useClientText()
  const lang = useClientLang().code
  const earlier = data.history.filter((h) => h.date !== data.today)
  const byDate = new Map<string, typeof earlier>()
  for (const h of earlier) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h])
  // Days with a recorded outcome but no alerts still get a row.
  for (const h of data.hearings) if (!byDate.has(h.date)) byDate.set(h.date, [])
  const outcomeOn = new Map(data.hearings.map((h) => [h.date, h]))
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  return (
    <Card data-tour="client-history">
      <p className="mb-2 flex items-center gap-2 text-h2">
        <History className="size-5" strokeWidth={1.75} /> {t.history}
      </p>
      {byDate.size === 0 ? (
        <p className="text-label text-ink-muted">{t.historyEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {dates.map((date) => {
            const items = byDate.get(date)!
            const o = outcomeOn.get(date)
            return (
            <li key={date}>
              <p className="mb-1 flex flex-wrap items-center gap-2 text-label font-semibold">
                {dateIn(lang, date)}
                {o && (
                  <Badge tone={o.outcome === 'closed' ? 'stale' : 'info'}>
                    {o.outcome === 'closed' ? t.caseEnded : t.nextHearing(dateIn(lang, o.nextDate!))}
                  </Badge>
                )}
              </p>
              {o?.summary && (
                <div className="mb-2 rounded-md bg-surface-raised p-2.5 text-label">
                  <p className="mb-0.5 text-caption font-semibold text-ink-muted">{t.whatHappened}</p>
                  {o.summary}
                </div>
              )}
              <ul className="flex flex-col gap-1.5 border-l-2 border-line pl-3">
                {[...items].reverse().map((h) => (
                  <li key={h.at + h.message} className="flex items-start gap-2 text-label">
                    <span className="flex-1">{h.message}</span>
                    <span className="shrink-0 text-caption text-ink-muted">{clockTime(h.at)}</span>
                  </li>
                ))}
              </ul>
            </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

type TabKey = 'home' | 'cases' | 'history' | 'chat' | 'settings'
interface Tab {
  key: TabKey
  label: (t: ReturnType<typeof useClientText>) => string
  icon: typeof Users
}
const ALL_TABS: Tab[] = [
  { key: 'home', label: (t) => t.navCase, icon: LayoutDashboard },
  { key: 'cases', label: (t) => t.yourCases, icon: FolderOpen },
  { key: 'history', label: (t) => t.history, icon: History },
  { key: 'chat', label: (t) => t.navChat, icon: MessageCircle },
  { key: 'settings', label: (t) => t.navSettings, icon: SettingsIcon },
]
/** Family links: no chat and only the shared case. */
const tabsFor = (kind: 'client' | 'family') => ALL_TABS.filter((x) => kind === 'client' || (x.key !== 'chat' && x.key !== 'cases'))
const pathOf = (key: TabKey) => (key === 'home' ? '/case' : `/case/${key}`)

/** Same frame as the lawyer app: sidebar on laptops, top bar + bottom tabs on phones. */
function ClientLayout({ children, data, tabs }: { children: React.ReactNode; data?: ClientView; tabs?: Tab[] }) {
  const t = useClientText()
  const chat = useChat()
  const { search } = useLocation()
  const unread = useUnreadCounts(null)
  const unreadTotal = Object.values(unread).reduce((a, b) => a + b, 0)
  const nav = tabs ?? []
  const phoneTabs = nav.filter((x) => x.key !== 'settings')
  const chatDot = data?.kind === 'client' && (
    <span
      title={chat.status === 'ready' ? 'Live' : chat.status === 'error' ? (chat.error ?? 'Chat offline') : 'Connecting'}
      className={cx('size-2.5 rounded-full', chat.status === 'ready' ? 'bg-hearing-fg' : chat.status === 'error' ? 'bg-stopped-fg' : 'cc-blink bg-waiting-fg')}
    />
  )
  const badge = (key: TabKey) =>
    key === 'chat' && unreadTotal > 0 ? (
      <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.7rem] font-bold text-accent-ink">{unreadTotal}</span>
    ) : null

  return (
    <div className="min-h-screen lg:flex">
      {/* Laptop sidebar */}
      {data && (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
          <Logo />
          <nav data-tour="client-menu" className="flex flex-col gap-1">
            {nav.map(({ key, label, icon: Icon }) => (
              <NavLink
                key={key}
                to={{ pathname: pathOf(key), search }}
                end
                data-tour={`client-nav-${key}`}
                className={({ isActive }) =>
                  cx('flex h-11 items-center gap-3 rounded-md px-3 text-body transition-colors', isActive ? 'bg-accent font-semibold text-accent-ink' : 'text-ink hover:bg-surface-raised')
                }
              >
                <Icon className="size-5" strokeWidth={1.75} /> <span className="flex-1">{label(t)}</span>
                {badge(key)}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto text-label">
            <p className="flex items-center gap-2 font-semibold text-ink">
              {data.clientName} {chatDot}
            </p>
            <p className="text-ink-muted">{data.firmName}</p>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar (whole header on every screen when there's no data yet) */}
        <header className={cx('sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4', data && 'lg:hidden')}>
          <Logo />
          {data && (
            <div className="flex min-w-0 items-center gap-2">
              {chatDot}
              <span className="truncate text-label text-ink-muted">{data.firmName}</span>
              <NavLink
                to={{ pathname: pathOf('settings'), search }}
                data-tour="client-nav-settings-phone"
                aria-label={t.navSettings}
                className={({ isActive }) => cx('flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised', isActive && 'bg-surface-raised text-accent')}
              >
                <SettingsIcon className="size-5" strokeWidth={1.75} />
              </NavLink>
            </div>
          )}
        </header>

        <main className={cx('mx-auto w-full max-w-[1600px] flex-1 px-4 pt-5 lg:px-10 lg:pb-10 lg:pt-8', data ? 'pb-28' : 'pb-10')}>{children}</main>

        {/* Phone bottom tabs */}
        {data && (
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="mx-auto flex max-w-[480px]">
              {phoneTabs.map(({ key, label, icon: Icon }) => (
                <NavLink
                  key={key}
                  to={{ pathname: pathOf(key), search }}
                  end
                  data-tour={`client-tab-${key}`}
                  className={({ isActive }) =>
                    cx('relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-caption', isActive ? 'font-semibold text-ink' : 'text-ink-muted')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-accent" />}
                      <span className="relative">
                        <Icon className="size-6" strokeWidth={1.75} />
                        {key === 'chat' && unreadTotal > 0 && <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-accent" />}
                      </span>
                      {label(t)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-h1 text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-label text-ink">{subtitle}</p>}
    </div>
  )
}

/** Light / dark / system, same as the lawyer Settings page. */
function ThemeCard() {
  const t = useClientText()
  const { pref, setPref } = useTheme()
  const options: [ThemePref, typeof Sun][] = [
    ['light', Sun],
    ['dark', Moon],
    ['system', Monitor],
  ]
  return (
    <Card>
      <p className="mb-3 text-h2">{t.appearance}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(([value, Icon]) => (
          <button
            key={value}
            onClick={() => setPref(value)}
            aria-pressed={pref === value}
            className={cx(
              'flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-label transition-colors',
              pref === value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:border-accent',
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} /> {t.themes[value]}
          </button>
        ))}
      </div>
    </Card>
  )
}
