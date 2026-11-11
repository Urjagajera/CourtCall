import { CalendarCheck, Landmark, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '../../components/AppLayout'
import { Badge, Banner, Card, EmptyState, PageSpinner } from '../../components/ui'
import type { Case } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDate, todayISO } from '../../lib/dates'
import { useApi } from '../../lib/useApi'

// Day view: today's cases grouped by courtroom. Live progress per room is added with the courtroom module.
export default function Today() {
  const { user } = useAuth()
  const today = todayISO()
  const { data, error, loading } = useApi<{ cases: Case[] }>(`/cases?date=${today}`)

  const rooms = useMemo(() => {
    const map = new Map<string, { label: string; complex: string; cases: Case[] }>()
    for (const c of data?.cases ?? []) {
      const entry = map.get(c.courtroomId) ?? { label: `Court ${c.roomNo}`, complex: c.courtComplex, cases: [] }
      entry.cases.push(c)
      map.set(c.courtroomId, entry)
    }
    return [...map.values()]
  }, [data])

  return (
    <>
      <PageHeader title={`Good day, ${user!.name.split(' ')[0]}`} subtitle={formatDate(today)} />
      {error && <Banner tone="stopped">{error}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : rooms.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <Card key={r.label + r.complex}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-h2">
                    <Landmark className="size-5" strokeWidth={1.75} /> {r.label}
                  </p>
                  <p className="text-label text-ink-muted">{r.complex}</p>
                </div>
                <Badge tone="stale">Not started</Badge>
              </div>
              <ul className="divide-y divide-line">
                {r.cases.map((c) => (
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
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CalendarCheck className="size-10" strokeWidth={1.5} />} title="No hearings today">
            Cases listed for today will appear here, grouped by courtroom.
          </EmptyState>
        </Card>
      )}
    </>
  )
}
