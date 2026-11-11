import { CalendarCheck, ChevronRight, Landmark, LogIn, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { Sheet } from '../../components/Sheet'
import { Badge, Banner, Button, Card, EmptyState, Input, PageSpinner } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { statusMeta, timeAgo, useNow, usePolling, type Courtroom, type MyCase, type SessionState } from '../../lib/court'
import { formatDate } from '../../lib/dates'
import { useForm } from '../../lib/useForm'

type TodaySession = SessionState & { courtroom: Courtroom; myCases: MyCase[] }

// Day view: every courtroom I follow today, with live progress and my office's cases in it.
export default function Today() {
  const { user } = useAuth()
  const now = useNow()
  const [data, setData] = useState<{ date: string; sessions: TodaySession[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api('/courtrooms/today'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 10000)

  return (
    <>
      <PageHeader
        title={`Good day, ${user!.name.split(' ')[0]}`}
        subtitle={data ? formatDate(data.date) : undefined}
        action={
          <Button variant="secondary" onClick={() => setJoinOpen(true)} icon={<LogIn className="size-5" strokeWidth={1.75} />}>
            Join courtroom
          </Button>
        }
      />
      {error && <Banner tone="stopped">{error}</Banner>}
      {!data ? (
        !error && <PageSpinner />
      ) : data.sessions.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.sessions.map((s) => (
            <RoomCard key={s.id} s={s} now={now} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CalendarCheck className="size-10" strokeWidth={1.5} />} title="No courtrooms today">
            Rooms with your office's cases for today appear here automatically. You can also join any courtroom.
          </EmptyState>
        </Card>
      )}
      {joinOpen && <JoinSheet onClose={() => setJoinOpen(false)} />}
    </>
  )
}

function RoomCard({ s, now }: { s: TodaySession; now: number }) {
  const st = statusMeta(s)
  const recall = s.hearingItem != null && s.currentItem != null && s.hearingItem !== s.currentItem

  return (
    <Link to={`/room/${s.id}`} className="group block rounded-lg focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-accent">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-h2">
              <Landmark className="size-5" strokeWidth={1.75} /> Court {s.courtroom.roomNo}
            </p>
            <p className="truncate text-label text-ink-muted">{s.courtroom.courtComplex}</p>
          </div>
          <Badge tone={st.tone} icon={<st.icon className="size-3.5" strokeWidth={1.75} />}>
            {st.label}
          </Badge>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-caption text-ink-muted">Latest progress</p>
            <p className="tabular text-[2.5rem] font-bold leading-none">{s.currentItem ?? '—'}</p>
          </div>
          <div className="text-right text-caption text-ink-muted">
            {recall && <p className="font-semibold text-waiting-fg">Recalled: Item {s.hearingItem}</p>}
            <p>{timeAgo(s.lastEventAt, now)}</p>
          </div>
        </div>

        {s.myCases.length > 0 && (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {s.myCases.map((c) => {
              const away = s.currentItem != null ? c.itemNo - s.currentItem : null
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="tabular flex h-8 min-w-11 items-center justify-center rounded-sm bg-accent px-2 text-label font-bold text-accent-ink">
                    {c.itemNo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold">{c.title}</span>
                    <span className="flex items-center gap-1 text-caption text-ink-muted">
                      <UserRound className="size-3" strokeWidth={1.75} /> {c.clientName}
                    </span>
                  </span>
                  {away != null && (
                    <span className="tabular shrink-0 text-caption font-semibold text-ink-muted">
                      {away > 0 ? `${away} away` : away === 0 ? 'Now' : 'Passed'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 flex items-center justify-end gap-1 text-label font-semibold">
          Open room <ChevronRight className="size-4" strokeWidth={1.75} />
        </p>
      </Card>
    </Link>
  )
}

function JoinSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [known, setKnown] = useState<Courtroom[]>([])
  const { field, values, submit, submitting, formError } = useForm({ courtComplex: '', roomNo: '' })

  useEffect(() => {
    api<{ courtrooms: Courtroom[] }>('/courtrooms')
      .then((r) => setKnown(r.courtrooms))
      .catch(() => {})
  }, [])
  const complexes = [...new Set(known.map((k) => k.courtComplex))]

  const join = (courtComplex: string, roomNo: string) =>
    submit(async () => {
      const { sessionId } = await api<{ sessionId: string }>('/courtrooms/join', { body: { courtComplex, roomNo } })
      navigate(`/room/${sessionId}`)
    })

  return (
    <Sheet open title="Join a courtroom" onClose={onClose}>
      <p className="mb-4 text-label text-ink-muted">
        Courtroom progress is shared with verified lawyers and juniors from all offices in the room.
      </p>
      {known.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {known.slice(0, 12).map((k) => (
            <button
              key={k.id}
              onClick={() => join(k.courtComplex, k.roomNo)}
              className="rounded-md border border-line bg-surface-raised px-3 py-2 text-left text-label hover:border-accent"
            >
              <span className="font-semibold">Court {k.roomNo}</span>
              <span className="block text-caption text-ink-muted">{k.courtComplex}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          join(values.courtComplex, values.roomNo)
        }}
      >
        {formError && <Banner tone="stopped">{formError}</Banner>}
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input label="Court complex" required list="court-complexes" {...field('courtComplex')} />
          <Input label="Court no." required {...field('roomNo')} />
        </div>
        <datalist id="court-complexes">
          {complexes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Button type="submit" loading={submitting}>
          Join room
        </Button>
      </form>
    </Sheet>
  )
}
