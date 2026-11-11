import { BellRing, Clock, Coffee, Landmark, MessageCircle, UserRound } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { cx } from '../../components/ui'

// Hero visual built from CourtCall's own screens (lawyer dashboard + client's phone), not an illustration.
// Numbers update live with subtle motion only.

const CLIENT_ITEM = 15

type Status = 'hearing' | 'break'

export function HeroScreens({ item, status }: { item: number; status: Status }) {
  const away = CLIENT_ITEM - item
  const rooms = [
    { court: '4', complex: 'Gujarat High Court', item, status, updated: 'just now', cases: [{ n: 15, who: 'Ramesh Patel' }, { n: 22, who: 'Sunita Joshi' }] },
    { court: '7', complex: 'Gujarat High Court', item: 6, status: 'hearing' as const, updated: '4 min ago', cases: [{ n: 9, who: 'Ramesh Patel' }] },
    { court: '12', complex: 'City Civil Court', item: 31, status: 'stale' as const, updated: '26 min ago', cases: [{ n: 40, who: 'Kiran Shah' }] },
  ]

  return (
    <div className="relative pb-10 sm:pb-0 sm:pr-24 lg:pr-28">
      {/* Lawyer dashboard window */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sheet">
        <div className="flex items-center justify-between border-b border-line bg-surface-raised px-4 py-3">
          <Logo />
          <span className="text-caption font-medium text-ink-muted">Mehta &amp; Associates · Today</span>
        </div>
        <div className="grid gap-3 bg-base p-3 sm:grid-cols-2 sm:p-4">
          {rooms.map((r, i) => (
            <div key={r.court} className={cx('rounded-md border border-line bg-surface p-3', i === 2 && 'hidden sm:block')}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-label font-semibold">
                  <Landmark className="size-4 text-detail" strokeWidth={1.75} /> Court {r.court}
                </p>
                <StatusChip status={r.status} />
              </div>
              <p className="text-caption text-ink-muted">{r.complex}</p>
              <div className="mt-2 flex items-end justify-between">
                <span className="overflow-hidden [perspective:400px]">
                  <span key={r.item} className="cc-flip tabular inline-block text-[2rem] font-bold leading-none">
                    {r.item}
                  </span>
                </span>
                <span className="text-caption text-ink-muted">{r.updated}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                {r.cases.map((c) => {
                  const d = c.n - r.item
                  return (
                    <li key={c.n} className="flex items-center gap-2 text-caption">
                      <span className="tabular flex h-6 min-w-8 items-center justify-center rounded-sm bg-accent px-1 font-bold text-accent-ink">{c.n}</span>
                      <span className="flex-1 truncate">{c.who}</span>
                      <span className="tabular font-semibold text-ink-muted">{d > 0 ? `${d} away` : d === 0 ? 'Now' : 'Passed'}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <div className="hidden rounded-md border border-dashed border-line p-3 text-caption text-ink-muted sm:flex sm:flex-col sm:justify-center">
            <p className="font-semibold text-ink">Shared rooms</p>
            <p>Court 4 progress is reported by juniors from 3 offices.</p>
          </div>
        </div>
      </div>

      {/* Client's phone */}
      <div className="absolute -bottom-2 right-2 w-[46%] max-w-[230px] sm:-bottom-10 sm:right-0 sm:w-[230px]">
        <div className="rounded-[1.75rem] border-[5px] border-[#2a2220] bg-surface p-3 shadow-sheet">
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#2a2220]/25" />
          <p className="text-caption text-ink-muted">Your case · Court 4</p>
          <p className="truncate text-label font-bold">Patel vs State</p>
          <div className="mt-2 rounded-md border border-line bg-surface-raised p-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] text-ink-muted">Now</p>
                <p key={item} className="cc-flip tabular text-h1 leading-none">{item}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-ink-muted">Yours</p>
                <p className="tabular text-h1 leading-none text-accent">{CLIENT_ITEM}</p>
              </div>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-line">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-detail transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(6, ((item - 9) / (CLIENT_ITEM - 9)) * 100))}%` }}
              />
            </div>
          </div>
          <div key={item + status} className="cc-pop mt-2 flex gap-1.5 rounded-md bg-base p-2 text-[11px] leading-snug">
            <BellRing className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
            <span>
              {status === 'break'
                ? 'Court 4 is on a short break.'
                : away > 0
                  ? `Item ${item} is being heard. ${away} before yours.`
                  : away === 0
                    ? 'Your case is being heard now.'
                    : 'Progress has passed your item.'}
            </span>
          </div>
          <div className="mt-2 flex h-8 items-center justify-center gap-1 rounded-md bg-accent text-[11px] font-semibold text-accent-ink">
            <MessageCircle className="size-3.5" strokeWidth={1.75} /> Chat with lawyer
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: Status | 'stale' }) {
  if (status === 'stale')
    return (
      <span className="flex items-center gap-1 rounded-full bg-stale-bg px-2 py-0.5 text-[11px] font-semibold text-stale-fg">
        <Clock className="size-3" strokeWidth={2} /> Stale
      </span>
    )
  if (status === 'break')
    return (
      <span className="flex items-center gap-1 rounded-full bg-waiting-bg px-2 py-0.5 text-[11px] font-semibold text-waiting-fg">
        <Coffee className="size-3" strokeWidth={2} /> Break
      </span>
    )
  return (
    <span className="flex items-center gap-1 rounded-full bg-hearing-bg px-2 py-0.5 text-[11px] font-semibold text-hearing-fg">
      <UserRound className="size-3" strokeWidth={2} /> Hearing
    </span>
  )
}
