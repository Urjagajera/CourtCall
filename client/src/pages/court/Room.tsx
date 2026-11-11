import {
  ArrowLeft,
  Ban,
  CalendarX,
  ChevronDown,
  CirclePlay,
  Coffee,
  DoorClosed,
  Minus,
  Play,
  Plus,
  SkipForward,
  Undo2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Sheet } from '../../components/Sheet'
import { Toast, type ToastData } from '../../components/Toast'
import { Badge, Banner, Button, Card, PageSpinner, cx, type Tone } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import {
  EVENT_META,
  clockTime,
  statusMeta,
  timeAgo,
  useNow,
  usePolling,
  type CourtEventRow,
  type Courtroom,
  type EventType,
  type MyCase,
  type SessionState,
} from '../../lib/court'

interface RoomData {
  session: SessionState
  courtroom: Courtroom
  events: CourtEventRow[]
  activeReporters: number
  myCases: MyCase[]
}

interface ReportInput {
  type: EventType
  item?: number | null
  correctsEventId?: string
}

type ReportResponse =
  | { needsConfirmation: { reason: string; message: string }; session: SessionState }
  | { noop: string; session: SessionState }
  | { session: SessionState; event: { id: string; type: EventType; item: number | null } }

const tint: Record<Tone, string> = {
  hearing: 'bg-hearing-bg text-hearing-fg',
  waiting: 'bg-waiting-bg text-waiting-fg',
  stopped: 'bg-stopped-bg text-stopped-fg',
  stale: 'bg-stale-bg text-stale-fg',
  info: 'bg-info-bg text-info-fg',
}

export default function Room() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<RoomData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [confirm, setConfirm] = useState<{ input: ReportInput; message: string } | null>(null)
  const [picker, setPicker] = useState<{ type: EventType; title: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const now = useNow()

  // Draft item for "Now hearing". Follows the room (current + 1) until the reporter adjusts it.
  const [draft, setDraft] = useState(1)
  const touched = useRef(false)

  const load = useCallback(async () => {
    try {
      setData(await api<RoomData>(`/sessions/${id}`))
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load courtroom')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 5000)

  const version = data?.session.version
  const currentItem = data?.session.currentItem
  useEffect(() => {
    if (version === undefined || touched.current) return
    setDraft((currentItem ?? 0) + 1)
  }, [version, currentItem])

  const notify = useCallback((t: Omit<ToastData, 'id'>) => setToast({ ...t, id: Date.now() }), [])
  const dismiss = useCallback(() => setToast(null), [])

  // Always read the newest state (the Undo toast calls report() from an older render).
  const dataRef = useRef(data)
  dataRef.current = data

  async function report(input: ReportInput, confirmed = false) {
    const latest = dataRef.current
    if (!latest) return
    setBusy(true)
    try {
      const res = await api<ReportResponse>(`/sessions/${id}/events`, {
        body: { ...input, baseVersion: latest.session.version, confirm: confirmed || undefined },
      })
      if ('needsConfirmation' in res) {
        setConfirm({ input, message: res.needsConfirmation.message })
        return
      }
      if ('noop' in res) {
        notify({ tone: 'info', message: res.noop })
        return
      }
      touched.current = false
      const meta = EVENT_META[res.event.type]
      const eventId = res.event.id
      notify(
        res.event.type === 'correction'
          ? { tone: 'info', message: 'Last update undone' }
          : {
              tone: meta.tone,
              message: (
                <>
                  <b>{meta.label}</b>
                  {res.event.item != null && ` · Item ${res.event.item}`} reported
                </>
              ),
              durationMs: 10000,
              action: {
                label: 'Undo',
                onClick: () => report({ type: 'correction', correctsEventId: eventId }),
              },
            },
      )
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        touched.current = false
        const s = e.body.session as SessionState | undefined
        notify({
          tone: 'waiting',
          message: `Someone else just reported a newer update${s?.currentItem ? ` (progress: Item ${s.currentItem})` : ''}. Please check and report again.`,
          durationMs: 6000,
        })
        await load()
      } else {
        notify({ tone: 'stopped', message: e instanceof Error ? e.message : 'Could not send update' })
      }
    } finally {
      setBusy(false)
    }
  }

  // Passed-over items that have not been taken up again: quick picks for "Recalled".
  const pendingPassedOver = useMemo(() => {
    const set = new Set<number>()
    const undone = new Set(data?.events.filter((e) => e.correctsEventId).map((e) => e.correctsEventId))
    for (const e of [...(data?.events ?? [])].reverse()) {
      if (undone.has(e.id) || e.item == null) continue
      if (e.type === 'passed_over') set.add(e.item)
      if (e.type === 'recalled' || e.type === 'adjourned' || e.type === 'now_hearing') set.delete(e.item)
    }
    return [...set].sort((a, b) => a - b)
  }, [data])

  if (!data) {
    return loadError ? (
      <div className="flex flex-col gap-3">
        <Banner tone="stopped">{loadError}</Banner>
        <Link to="/" className="text-label font-semibold underline underline-offset-4">
          Back to today
        </Link>
      </div>
    ) : (
      <PageSpinner />
    )
  }

  const { session, courtroom, events, activeReporters, myCases } = data
  const st = statusMeta(session)
  const onBreak = session.status === 'break'
  const closed = session.status === 'risen' || session.status === 'not_sitting'
  const hearing = session.hearingItem
  const recallActive = hearing != null && session.currentItem != null && hearing !== session.currentItem
  const undoneIds = new Set(events.filter((e) => e.correctsEventId).map((e) => e.correctsEventId))

  const itemAction = (type: EventType, title: string) => {
    if (hearing != null && type !== 'recalled') report({ type, item: hearing })
    else setPicker({ type, title })
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/" aria-label="Back" className="flex size-11 items-center justify-center rounded-md hover:bg-surface">
          <ArrowLeft className="size-6" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-h1 leading-tight">Court {courtroom.roomNo}</h1>
          <p className="truncate text-label">{courtroom.courtComplex}</p>
        </div>
        <Badge tone={st.tone} icon={<st.icon className="size-3.5" strokeWidth={1.75} />}>
          {st.label}
        </Badge>
      </div>

      {/* Current progress */}
      <Card className="text-center">
        <p className="text-label text-ink-muted">{recallActive ? 'Recalled item being heard' : 'Latest reported progress'}</p>
        <p className="tabular text-display text-ink">{(recallActive ? hearing : session.currentItem) ?? '—'}</p>
        {recallActive && <p className="text-label text-ink-muted">Cause list progress: Item {session.currentItem}</p>}
        <p className={cx('mt-1 text-label', session.stale ? 'font-semibold text-stale-fg' : 'text-ink-muted')}>
          Updated {timeAgo(session.lastEventAt, now)}
          {session.stale && ' · may be out of date'}
        </p>
        <p className="mt-1 flex items-center justify-center gap-1 text-caption text-ink-muted">
          <Users className="size-3.5" strokeWidth={1.75} />
          {activeReporters === 0 ? 'No active reporters' : `${activeReporters} reporting in the last 20 min`}
        </p>
      </Card>

      {/* Main action: stepper + Now hearing */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepButton label="Previous item" icon={Minus} onClick={() => { touched.current = true; setDraft((d) => Math.max(1, d - 1)) }} />
          <input
            aria-label="Item number"
            type="number"
            inputMode="numeric"
            min={1}
            value={draft}
            onChange={(e) => {
              touched.current = true
              setDraft(Math.max(1, Number(e.target.value) || 1))
            }}
            onFocus={(e) => e.target.select()}
            className="tabular h-16 min-w-0 flex-1 rounded-md border border-line bg-surface-raised text-center text-[2rem] font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          <StepButton label="Next item" icon={Plus} onClick={() => { touched.current = true; setDraft((d) => d + 1) }} />
        </div>
        <button
          disabled={busy}
          onClick={() => report({ type: 'now_hearing', item: draft })}
          className="flex h-16 items-center justify-center gap-2 rounded-md bg-accent text-h2 font-bold text-accent-ink transition-colors hover:bg-accent-strong active:scale-[0.99] disabled:opacity-60"
        >
          <CirclePlay className="size-6" strokeWidth={1.75} />
          Now hearing: Item {draft}
        </button>
      </Card>

      {/* Secondary events */}
      <div className="grid grid-cols-2 gap-2">
        <EventButton
          icon={SkipForward}
          tone="waiting"
          label="Passed over"
          sub={hearing != null ? `Item ${hearing}` : 'Choose item'}
          disabled={busy}
          onClick={() => itemAction('passed_over', 'Which item was passed over?')}
        />
        <EventButton
          icon={Undo2}
          tone="waiting"
          label="Recalled"
          sub={pendingPassedOver.length ? `${pendingPassedOver.length} passed over` : 'Choose item'}
          disabled={busy}
          onClick={() => setPicker({ type: 'recalled', title: 'Which item was recalled?' })}
        />
        <EventButton
          icon={CalendarX}
          tone="stopped"
          label="Adjourned"
          sub={hearing != null ? `Item ${hearing}` : 'Choose item'}
          disabled={busy}
          onClick={() => itemAction('adjourned', 'Which item was adjourned?')}
        />
        <EventButton
          icon={onBreak ? Play : Coffee}
          tone={onBreak ? 'hearing' : 'waiting'}
          label={onBreak ? 'Resume' : 'Break'}
          sub={onBreak ? 'Court is back' : 'Lunch / short break'}
          disabled={busy || closed}
          onClick={() => report({ type: onBreak ? 'break_end' : 'break_start' })}
        />
        <EventButton
          icon={Ban}
          tone="stopped"
          label="Not sitting"
          sub="Judge on leave"
          disabled={busy}
          onClick={() => setConfirm({ input: { type: 'court_not_sitting' }, message: 'Report that this court is not sitting today? Everyone following this room will see it.' })}
        />
        <EventButton
          icon={DoorClosed}
          tone="stopped"
          label="Court risen"
          sub="Done for the day"
          disabled={busy}
          onClick={() => setConfirm({ input: { type: 'court_risen' }, message: 'Report that the court has risen for the day?' })}
        />
      </div>

      {/* My office's cases in this room */}
      {myCases.length > 0 && (
        <Card>
          <p className="mb-2 text-h2">Your cases here</p>
          <ul className="divide-y divide-line">
            {myCases.map((c) => {
              const away = session.currentItem != null ? c.itemNo - session.currentItem : null
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="tabular flex h-9 min-w-12 items-center justify-center rounded-sm bg-accent px-2 text-label font-bold text-accent-ink">
                    {c.itemNo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold">{c.title}</span>
                    <span className="flex items-center gap-1 text-caption text-ink-muted">
                      <UserRound className="size-3" strokeWidth={1.75} /> {c.clientName}
                    </span>
                  </span>
                  {away != null && (
                    <span className="tabular text-caption font-semibold text-ink-muted">
                      {away > 0 ? `${away} away` : away === 0 ? 'Now' : 'Passed'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* History */}
      <Card className="p-0">
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          aria-expanded={historyOpen}
          className="flex h-14 w-full items-center justify-between px-4 text-h2"
        >
          Update history
          <ChevronDown className={cx('size-5 transition-transform', historyOpen && 'rotate-180')} strokeWidth={1.75} />
        </button>
        {historyOpen && (
          <ul className="divide-y divide-line border-t border-line">
            {events.length === 0 && <li className="px-4 py-3 text-label text-ink-muted">No updates yet today.</li>}
            {events.map((e) => {
              const m = EVENT_META[e.type]
              const undone = undoneIds.has(e.id)
              return (
                <li key={e.id} className={cx('flex items-start gap-3 px-4 py-3', undone && 'opacity-50')}>
                  <span className={cx('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm', tint[m.tone])}>
                    <m.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-label font-semibold', undone && 'line-through')}>
                      {m.label}
                      {e.item != null && ` · Item ${e.item}`}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {e.reporterName}
                      {e.officeName && ` · ${e.officeName}`} · {clockTime(e.createdAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.singleReporter && <Badge tone="info">Single reporter</Badge>}
                      {e.confirmed && <Badge tone="waiting">Confirmed jump</Badge>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="pb-2 text-center text-caption text-ink">
        Updates are shared with verified lawyers and juniors in this courtroom. Client details stay private to your office.
      </p>

      {/* Confirmation (server-requested or for court-level events) */}
      <Sheet open={!!confirm} title="Please confirm" onClose={() => setConfirm(null)}>
        <p className="text-body">{confirm?.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            size="lg"
            loading={busy}
            onClick={async () => {
              const c = confirm!
              setConfirm(null)
              await report(c.input, true)
            }}
          >
            Confirm
          </Button>
        </div>
      </Sheet>

      {picker && (
        <ItemPicker
          title={picker.title}
          suggestions={picker.type === 'recalled' ? pendingPassedOver : hearing != null ? [hearing] : []}
          initial={picker.type === 'recalled' ? (pendingPassedOver[0] ?? draft) : (hearing ?? session.currentItem ?? draft)}
          actionLabel={EVENT_META[picker.type].label}
          onClose={() => setPicker(null)}
          onPick={(item) => {
            const type = picker.type
            setPicker(null)
            report({ type, item })
          }}
        />
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  )
}

function StepButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex size-16 shrink-0 items-center justify-center rounded-md border border-line bg-surface-raised text-ink active:bg-surface"
    >
      <Icon className="size-7" strokeWidth={1.75} />
    </button>
  )
}

function EventButton({
  icon: Icon,
  tone,
  label,
  sub,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  sub: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex min-h-16 items-center gap-3 rounded-md px-3 py-2 text-left transition active:scale-[0.98] disabled:opacity-50',
        tint[tone],
      )}
    >
      <Icon className="size-6 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="block text-label font-semibold">{label}</span>
        <span className="block truncate text-caption opacity-80">{sub}</span>
      </span>
    </button>
  )
}

function ItemPicker({
  title,
  suggestions,
  initial,
  actionLabel,
  onClose,
  onPick,
}: {
  title: string
  suggestions: number[]
  initial: number
  actionLabel: string
  onClose: () => void
  onPick: (item: number) => void
}) {
  const [value, setValue] = useState(String(initial))
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1

  return (
    <Sheet open title={title} onClose={onClose}>
      {suggestions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="tabular h-12 min-w-16 rounded-md border border-line bg-surface-raised px-4 text-h2 font-bold hover:bg-accent hover:text-accent-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onPick(n)
        }}
      >
        <input
          aria-label="Item number"
          type="number"
          inputMode="numeric"
          min={1}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="tabular h-14 w-28 rounded-md border border-line bg-surface-raised text-center text-h1 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
        />
        <Button type="submit" size="lg" className="flex-1" disabled={!valid}>
          {actionLabel}: Item {valid ? n : '…'}
        </Button>
      </form>
    </Sheet>
  )
}
