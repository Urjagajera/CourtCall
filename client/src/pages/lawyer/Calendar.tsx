import { ChevronLeft, ChevronRight, Gavel } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { Badge, Banner, Card, PageSpinner, cx } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { useApi } from '../../lib/useApi'

interface Event {
  kind: 'held' | 'upcoming' | 'needs_outcome'
  caseId: string
  title: string
  caseNo: string | null
  clientName: string
  date: string
  itemNo: number | null
  outcome: 'next_date' | 'closed' | null
  nextDate: string | null
  courtComplex: string
  roomNo: string
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOT: Record<Event['kind'], string> = { upcoming: 'bg-accent', held: 'bg-detail', needs_outcome: 'bg-waiting-fg' }

/** Month calendar of every hearing: upcoming, past (with outcome), and hearings still to update. */
export default function Calendar() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const first = month
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const { data, error } = useApi<{ today: string; events: Event[] }>(`/calendar?from=${iso(first)}&to=${iso(last)}`)
  const [picked, setPicked] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, Event[]>()
    for (const e of data?.events ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e])
    return m
  }, [data])

  // Monday-first grid with leading blanks.
  const lead = (first.getDay() + 6) % 7
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: last.getDate() }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  while (cells.length % 7) cells.push(null)
  const today = data?.today
  const listDays = picked ? [picked] : [...byDay.keys()].sort()
  const go = (n: number) => {
    setPicked(null)
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  }

  return (
    <>
      <PageHeader title="Calendar" subtitle="Every hearing of the clients you look after" />
      {error && <Banner tone="stopped">{error}</Banner>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <Card data-tour="calendar-grid">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => go(-1)} aria-label="Previous month" className="flex size-10 items-center justify-center rounded-md hover:bg-surface-raised">
              <ChevronLeft className="size-5" strokeWidth={1.75} />
            </button>
            <p className="text-h2">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
            <button onClick={() => go(1)} aria-label="Next month" className="flex size-10 items-center justify-center rounded-md hover:bg-surface-raised">
              <ChevronRight className="size-5" strokeWidth={1.75} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-caption font-semibold text-ink-muted">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {!data ? (
            <PageSpinner />
          ) : (
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((d, i) =>
                d === null ? (
                  <span key={`b${i}`} />
                ) : (
                  <button
                    key={d}
                    onClick={() => setPicked(picked === d ? null : d)}
                    aria-pressed={picked === d}
                    aria-label={`${formatDate(d)}: ${byDay.get(d)?.length ?? 0} hearings`}
                    className={cx(
                      'flex min-h-14 flex-col items-center gap-1 rounded-md border p-1 text-label transition-colors sm:min-h-20 sm:items-start sm:p-1.5',
                      picked === d ? 'border-accent bg-accent/10' : 'border-line hover:border-accent',
                      d === today && 'ring-2 ring-accent/50',
                    )}
                  >
                    <span className={cx('tabular', d === today && 'font-bold text-accent')}>{Number(d.slice(8))}</span>
                    <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                      {(byDay.get(d) ?? []).slice(0, 4).map((e, k) => (
                        <span key={k} className={cx('size-1.5 rounded-full', DOT[e.kind])} />
                      ))}
                    </span>
                    <span className="hidden w-full flex-col gap-0.5 sm:flex">
                      {(byDay.get(d) ?? []).slice(0, 3).map((e, k) => (
                        <span key={k} className="flex w-full items-center gap-1 truncate text-left text-[0.7rem] leading-tight">
                          <span className={cx('size-1.5 shrink-0 rounded-full', DOT[e.kind])} />
                          <span className="truncate">{e.clientName}</span>
                        </span>
                      ))}
                      {(byDay.get(d)?.length ?? 0) > 3 && <span className="text-[0.7rem] text-ink-muted">+{byDay.get(d)!.length - 3} more</span>}
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-caption text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-accent" /> Upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-detail" /> Held
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-waiting-fg" /> To update
            </span>
          </div>
        </Card>

        <Card>
          <p className="text-h2">{picked ? formatDate(picked) : 'This month'}</p>
          {data && listDays.length === 0 && <p className="mt-2 text-label text-ink-muted">{picked ? 'No hearings on this day.' : 'No hearings this month.'}</p>}
          <div className="mt-2 flex flex-col gap-4">
            {listDays.map((d) => (
              <div key={d}>
                {!picked && <p className="mb-1 text-label font-semibold">{formatDate(d)}</p>}
                <ul className="flex flex-col gap-2">
                  {(byDay.get(d) ?? []).map((e) => (
                    <li key={e.kind + e.caseId + e.date}>
                      <Link to={`/cases/${e.caseId}`} className="flex items-start gap-2 rounded-md border border-line p-2.5 hover:border-accent">
                        <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', DOT[e.kind])} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-label font-semibold">{e.title}</span>
                          <span className="block truncate text-caption text-ink-muted">
                            {e.clientName} · {e.courtComplex} · Court {e.roomNo}
                            {e.itemNo != null && ` · Item ${e.itemNo}`}
                          </span>
                        </span>
                        {e.kind === 'needs_outcome' ? (
                          <Badge tone="waiting">Update</Badge>
                        ) : e.kind === 'held' ? (
                          e.outcome === 'closed' ? (
                            <Badge tone="stale" icon={<Gavel className="size-3.5" strokeWidth={1.75} />}>
                              Ended
                            </Badge>
                          ) : (
                            <Badge tone="info">Next {e.nextDate ? formatDate(e.nextDate) : ''}</Badge>
                          )
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
