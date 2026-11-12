import { ArrowLeft, CalendarDays, ChevronRight, Gavel, Hash, Languages, Landmark, Phone, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { Badge, Banner, Button, Card, EmptyState, PageSpinner } from '../../components/ui'
import type { Case, Client, Hearing } from '../../lib/api'
import { formatDate, todayISO } from '../../lib/dates'
import { useAuth } from '../../lib/auth'
import { useApi } from '../../lib/useApi'

interface Detail {
  client: Client
  cases: (Case & { hearings: Hearing[]; mainLawyerName: string | null; helpingJuniorName: string | null; staffHelperName: string | null })[]
}

const LANG: Record<string, string> = { en: 'English', hi: 'Hindi', gu: 'Gujarati' }

/** One client: contact details, who looks after them, and every case with its latest hearing. */
export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, error } = useApi<Detail>(`/clients/${id}/detail`)
  const today = todayISO()

  const back = (
    <button onClick={() => navigate(-1)} className="mb-2 flex items-center gap-1.5 text-label font-semibold text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={1.75} /> Back
    </button>
  )
  if (error)
    return (
      <>
        {back}
        <Banner tone="stopped">{error}</Banner>
      </>
    )
  if (!data) return <PageSpinner />
  const { client } = data
  const active = data.cases.filter((c) => c.status === 'active')
  const closed = data.cases.filter((c) => c.status === 'closed')

  return (
    <>
      {back}
      <PageHeader
        title={client.name}
        subtitle={`${active.length} active ${active.length === 1 ? 'case' : 'cases'}${closed.length ? ` · ${closed.length} closed` : ''}`}
        action={
          // New cases: firm admins and senior lawyers (who become the main lawyer).
          user!.role === 'lawyer' && (
            <Button onClick={() => navigate(`/cases?new=${client.id}`)} icon={<Plus className="size-5" strokeWidth={1.75} />}>
              Add case
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <Card>
          <p className="text-h2">Client details</p>
          <ul className="mt-3 flex flex-col gap-2 text-label">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-ink-muted" strokeWidth={1.75} />
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="underline underline-offset-4">
                  {client.phone}
                </a>
              ) : (
                <span className="text-ink-muted">No phone added</span>
              )}
            </li>
            <li className="flex items-center gap-2">
              <Languages className="size-4 text-ink-muted" strokeWidth={1.75} /> Alerts in {LANG[client.language]}
            </li>
          </ul>
          <p className="mt-4 text-caption text-ink-muted">
            {user!.isFirmAdmin ? 'You see all of this client’s cases.' : 'You see the cases of this client that you are on.'}
          </p>
        </Card>

        <div data-tour="client-detail-cases" className="flex min-w-0 flex-col gap-3">
          {data.cases.length === 0 && (
            <EmptyState icon={<CalendarDays className="size-6" strokeWidth={1.75} />} title="No cases yet">
              Add the first case for {client.name}.
            </EmptyState>
          )}
          {data.cases.map((c) => {
            const last = c.hearings[0]
            const pending = c.status === 'active' && c.hearingDate < today
            return (
              <Link key={c.id} to={`/cases/${c.id}`} className="block">
                <Card className="flex items-center gap-3 transition-colors hover:border-accent">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-body font-semibold">{c.title}</p>
                      {c.status === 'closed' ? (
                        <Badge tone="stale" icon={<Gavel className="size-3.5" strokeWidth={1.75} />}>
                          Closed
                        </Badge>
                      ) : pending ? (
                        <Badge tone="waiting">Update hearing</Badge>
                      ) : c.hearingDate === today ? (
                        <Badge tone="hearing">Today</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Hash className="size-3.5" strokeWidth={1.75} /> {c.caseNo ?? 'No case no.'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Landmark className="size-3.5" strokeWidth={1.75} /> {c.courtComplex} · Court {c.roomNo}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" strokeWidth={1.75} />
                        {c.status === 'closed' ? 'Last' : 'Next'}: {formatDate(c.hearingDate)}
                        {c.itemNo != null && ` · Item ${c.itemNo}`}
                      </span>
                    </p>
                    <p className="mt-1 text-caption text-ink-muted">
                      Main: <span className="font-semibold text-ink">{c.mainLawyerName ?? '—'}</span>
                      {c.helpingJuniorName && <> · Junior: {c.helpingJuniorName}</>}
                      {c.staffHelperName && <> · Staff: {c.staffHelperName}</>}
                    </p>
                    {last?.summary && <p className="mt-2 line-clamp-2 text-label">{last.summary}</p>}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-muted" strokeWidth={1.75} />
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
