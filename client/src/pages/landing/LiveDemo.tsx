import { BellRing, CirclePlay, Coffee, History, Landmark, MessageCircle, Play, ShieldAlert, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../../components/ui'
import { prefersReducedMotion } from '../../lib/useReveal'

// Interactive mini-simulation: tap as the junior, watch the client's phone update.
// Shows the real rules: alerts get closer as progress approaches, delayed updates are ignored.

const CLIENT_ITEM = 15

type Log = { id: number; tone: 'ok' | 'warn' | 'bad'; text: string }

export function LiveDemo() {
  const [item, setItem] = useState(11)
  const [version, setVersion] = useState(7)
  const [onBreak, setOnBreak] = useState(false)
  const [log, setLog] = useState<Log[]>([{ id: 0, tone: 'ok', text: 'v7 · Now hearing Item 11' }])
  const [alerts, setAlerts] = useState<{ id: number; text: string }[]>([
    { id: 0, text: `Court 4 has started. Your case is Item ${CLIENT_ITEM}. Latest reported progress: Item 11.` },
  ])
  const idle = useRef(0)

  const addLog = (tone: Log['tone'], text: string) => setLog((l) => [{ id: Date.now() + Math.random(), tone, text }, ...l].slice(0, 4))
  const addAlert = (text: string) => setAlerts((a) => [{ id: Date.now() + Math.random(), text }, ...a].slice(0, 3))

  function nowHearing() {
    idle.current = 0
    const next = item >= 18 ? 11 : item + 1
    const v = version + 1
    setItem(next)
    setVersion(v)
    setOnBreak(false)
    addLog('ok', `v${v} · Now hearing Item ${next}`)
    const away = CLIENT_ITEM - next
    if (next === 11) addAlert(`New day demo: progress reset to Item 11.`)
    else if (away === 0) addAlert(`Your case (Item ${CLIENT_ITEM}) is now being heard. Follow your lawyer's instructions.`)
    else if (away > 0 && [10, 5, 2, 1].includes(away))
      addAlert(`Latest reported progress: Item ${next}. Your case is Item ${CLIENT_ITEM}. Please stay available.`)
    else if (away < 0) addAlert(`Progress has moved past Item ${CLIENT_ITEM}. Your lawyer will update you.`)
  }

  function passedOver() {
    idle.current = 0
    const v = version + 1
    setVersion(v)
    addLog('warn', `v${v} · Item ${item} passed over`)
  }

  function toggleBreak() {
    idle.current = 0
    const v = version + 1
    setVersion(v)
    setOnBreak((b) => !b)
    addLog('warn', `v${v} · ${onBreak ? 'Break ended' : 'Break started'}`)
    if (!onBreak) addAlert('Court 4 is on a short break. Latest reported progress is unchanged.')
  }

  function delayed() {
    idle.current = 0
    addLog('bad', `Rejected: a delayed update based on v${version - 2} (Item ${item - 2}) arrived late. Newer progress kept.`)
  }

  // Auto-play when the visitor is not interacting.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setInterval(() => {
      idle.current += 1
      if (idle.current >= 3) {
        idle.current = 1
        document.getElementById('demo-next')?.click()
      }
    }, 1500)
    return () => clearInterval(t)
  }, [])

  const away = CLIENT_ITEM - item

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto_1fr]">
      {/* Junior's phone */}
      <Phone label="Junior lawyer in Court 4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-label font-bold">
            <Landmark className="size-4" strokeWidth={1.75} /> Court 4
          </p>
          <span
            className={cx(
              'rounded-full px-2 py-0.5 text-caption font-semibold',
              onBreak ? 'bg-waiting-bg text-waiting-fg' : 'bg-hearing-bg text-hearing-fg',
            )}
          >
            {onBreak ? 'On break' : 'Hearing'}
          </span>
        </div>
        <div className="my-3 rounded-md border border-line bg-surface-raised py-2 text-center">
          <p className="text-caption text-ink-muted">Latest progress</p>
          <p key={item} className="cc-flip tabular text-[2.5rem] font-bold leading-tight">
            {item}
          </p>
        </div>
        <button
          id="demo-next"
          onClick={nowHearing}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent text-label font-bold text-accent-ink active:scale-[0.98]"
        >
          <CirclePlay className="size-5" strokeWidth={1.75} /> Now hearing: Item {item >= 18 ? 11 : item + 1}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={passedOver} className="flex h-11 items-center justify-center gap-1 rounded-md bg-waiting-bg text-caption font-semibold text-waiting-fg">
            <SkipForward className="size-4" strokeWidth={1.75} /> Passed over
          </button>
          <button onClick={toggleBreak} className="flex h-11 items-center justify-center gap-1 rounded-md bg-waiting-bg text-caption font-semibold text-waiting-fg">
            {onBreak ? <Play className="size-4" strokeWidth={1.75} /> : <Coffee className="size-4" strokeWidth={1.75} />}
            {onBreak ? 'Resume' : 'Break'}
          </button>
        </div>
        <button onClick={delayed} className="mt-2 flex h-11 w-full items-center justify-center gap-1 rounded-md border border-dashed border-line text-caption font-semibold text-ink-muted">
          <ShieldAlert className="size-4" strokeWidth={1.75} /> Simulate a delayed old update
        </button>
      </Phone>

      {/* Server in the middle */}
      <div className="flex flex-col items-center gap-3 lg:mt-16 lg:w-64">
        <div className="relative flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sheet">
          <span className="cc-ring absolute inset-0 rounded-full border-2 border-accent" />
          <History className="size-7" strokeWidth={1.75} />
        </div>
        <p className="text-center text-label font-semibold">CourtCall checks every update</p>
        <ul className="flex w-full max-w-sm flex-col gap-1.5">
          {log.map((l) => (
            <li
              key={l.id}
              className={cx(
                'cc-pop rounded-md border-l-4 bg-surface px-3 py-2 text-caption',
                l.tone === 'ok' && 'border-l-hearing-fg',
                l.tone === 'warn' && 'border-l-waiting-fg',
                l.tone === 'bad' && 'border-l-stopped-fg text-stopped-fg',
              )}
            >
              {l.text}
            </li>
          ))}
        </ul>
      </div>

      {/* Client's phone */}
      <Phone label="Client, via WhatsApp link">
        <p className="text-caption text-ink-muted">Your case</p>
        <p className="text-label font-bold">Shah vs State · Court 4</p>
        <div className="mt-3 rounded-md border border-line bg-surface-raised p-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-caption text-ink-muted">Now</p>
              <p key={item} className="cc-flip tabular text-h1">{item}</p>
            </div>
            <div className="text-right">
              <p className="text-caption text-ink-muted">Yours</p>
              <p className="tabular text-h1 text-ink">{CLIENT_ITEM}</p>
            </div>
          </div>
          <div className="relative mt-2 h-2 rounded-full bg-line">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-base-strong transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(4, ((item - 10) / (CLIENT_ITEM - 10)) * 100))}%` }}
            />
            <span className="absolute -top-1 right-0 size-4 rounded-full border-2 border-surface bg-accent" />
          </div>
          <p className="mt-2 text-caption font-semibold">
            {away > 0 ? `${away} item${away === 1 ? '' : 's'} before yours` : away === 0 ? 'Your case is being heard' : 'Progress has passed your item'}
          </p>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {alerts.map((a) => (
            <li key={a.id} className="cc-pop flex gap-2 rounded-md bg-surface-raised p-2 text-caption">
              <BellRing className="mt-0.5 size-4 shrink-0 text-ink" strokeWidth={1.75} />
              {a.text}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-md bg-accent text-caption font-bold text-accent-ink">
          <MessageCircle className="size-4" strokeWidth={1.75} /> Chat with your lawyer
        </div>
      </Phone>
    </div>
  )
}

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[2rem] border-[6px] border-[#1B1B22] bg-surface p-4 shadow-sheet">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#1B1B22]/30" />
        {children}
      </div>
      <figcaption className="mt-2 text-center text-label font-semibold text-ink">{label}</figcaption>
    </figure>
  )
}
