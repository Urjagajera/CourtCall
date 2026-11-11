import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Gavel,
  Hash,
  Landmark,
  Link2,
  ListOrdered,
  Lock,
  Pencil,
  UserRound,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { LinkSheet } from '../../components/LinkSheet'
import { OutcomeSheet } from '../../components/OutcomeSheet'
import { Sheet } from '../../components/Sheet'
import { Badge, Banner, Button, Card, PageSpinner, Textarea } from '../../components/ui'
import { api, type Case, type Hearing } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDate, todayISO } from '../../lib/dates'
import { useApi } from '../../lib/useApi'

interface Detail {
  case: Case & { clientPhone: string | null }
  hearings: Hearing[]
  assignees: { id: string; name: string; role: string }[]
  junior: { id: string; name: string } | null
  links: { active: number; openedOnPhone: boolean }
  needsOutcome: boolean
}

const ROLE: Record<string, string> = { lawyer: 'Senior lawyer', staff: 'Office staff' }

/** Everything about one case: details, next hearing, who looks after it, every past hearing with notes. */
export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, error, reload } = useApi<Detail>(`/cases/${id}/detail`)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [editing, setEditing] = useState<Hearing | null>(null)
  const canEdit = user!.role !== 'junior'

  if (error) {
    return (
      <>
        <BackLink />
        <Banner tone="stopped">{error}</Banner>
      </>
    )
  }
  if (!data) return <PageSpinner />
  const c = data.case
  const today = todayISO()
  const upcoming = c.status === 'active' && c.hearingDate >= today

  return (
    <>
      <BackLink />
      <PageHeader
        title={c.title}
        subtitle={c.clientName}
        action={
          canEdit && c.status === 'active' ? (
            <Button variant="secondary" onClick={() => setLinkOpen(true)} icon={<Link2 className="size-5" strokeWidth={1.75} />}>
              Client link
            </Button>
          ) : undefined
        }
      />

      {data.needsOutcome && (
        <Card className="flex flex-wrap items-center gap-3 border-2 border-waiting-fg/40">
          <BellRing className="size-6 shrink-0 text-waiting-fg" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-label">
            <span className="font-semibold">The hearing on {formatDate(c.hearingDate)} is over.</span> Record what happened and the next date.
          </p>
          <Button onClick={() => setOutcomeOpen(true)}>Update hearing</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="text-h2">Case details</p>
              {c.status === 'closed' ? (
                <Badge tone="stale" icon={<CheckCircle2 className="size-3.5" strokeWidth={1.75} />}>
                  Closed
                </Badge>
              ) : (
                <Badge tone="hearing">Active</Badge>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-label">
              <Row icon={Hash} label="Case no.">
                {c.caseNo ?? <span className="text-stopped-fg">Not added (needed for the client link)</span>}
              </Row>
              <Row icon={UserRound} label="Client">
                <Link to={`/clients/${c.clientId}`} className="font-semibold underline underline-offset-4">
                  {c.clientName}
                </Link>
              </Row>
              <Row icon={Landmark} label="Court">
                {c.courtComplex} · Court {c.roomNo}
              </Row>
              <Row icon={CalendarDays} label={c.status === 'closed' ? 'Last hearing' : upcoming ? 'Next hearing' : 'Hearing'}>
                {c.hearingDate === today ? 'Today' : formatDate(c.hearingDate)}
              </Row>
              <Row icon={ListOrdered} label="Item no.">
                {c.itemNo ?? <span className="text-ink-muted">Not out yet (add it when the cause list is out)</span>}
              </Row>
              <Row icon={Users} label="Junior in court">
                {data.junior?.name ?? <span className="text-ink-muted">Not set</span>}
              </Row>
              <Row icon={Link2} label="Client link">
                {data.links.active ? (data.links.openedOnPhone ? 'Shared and opened on the client’s phone' : 'Shared, not opened yet') : 'Not shared yet'}
              </Row>
            </dl>
          </Card>

          <Card>
            <p className="text-h2">Who looks after this client</p>
            {data.assignees.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.assignees.map((a) => (
                  <li key={a.id} className="rounded-full border border-line bg-surface-raised px-3 py-1 text-label">
                    {a.name} <span className="text-caption text-ink-muted">· {ROLE[a.role] ?? a.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-label text-ink-muted">Nobody yet. Firm admins see this client.</p>
            )}
          </Card>
        </div>

        <Card>
          <p className="text-h2">Hearings</p>
          <ol className="mt-3 flex flex-col gap-4">
            {c.status === 'active' && (
              <li className="flex gap-3">
                <span className="mt-1 size-3 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-label font-semibold">
                    {formatDate(c.hearingDate)} · {upcoming ? 'Next hearing' : 'Outcome not recorded'}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {c.courtComplex} · Court {c.roomNo}
                    {c.itemNo != null && ` · Item ${c.itemNo}`}
                  </p>
                </div>
              </li>
            )}
            {data.hearings.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="mt-1 size-3 shrink-0 rounded-full border-2 border-detail" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-label font-semibold">{formatDate(h.date)}</p>
                    {h.outcome === 'closed' ? (
                      <Badge tone="stale" icon={<Gavel className="size-3.5" strokeWidth={1.75} />}>
                        Case ended
                      </Badge>
                    ) : (
                      <Badge tone="info">Next date {h.nextDate ? formatDate(h.nextDate) : ''}</Badge>
                    )}
                    {canEdit && (
                      <button onClick={() => setEditing(h)} aria-label="Edit notes" className="ml-auto flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink">
                        <Pencil className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                  <p className="text-caption text-ink-muted">
                    {h.courtComplex} · Court {h.roomNo}
                    {h.itemNo != null && ` · Item ${h.itemNo}`}
                    {h.recordedByName && ` · recorded by ${h.recordedByName}`}
                  </p>
                  {h.summary && (
                    <div className="mt-2 rounded-md bg-surface-raised p-2.5 text-label">
                      <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-ink-muted">
                        {h.shareWithClient ? <Eye className="size-3.5" strokeWidth={1.75} /> : <EyeOff className="size-3.5" strokeWidth={1.75} />}
                        What happened {h.shareWithClient ? '· client can see this' : '· firm only'}
                      </p>
                      {h.summary}
                    </div>
                  )}
                  {h.prepNotes && (
                    <div className="mt-2 rounded-md border border-dashed border-line p-2.5 text-label">
                      <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-ink-muted">
                        <ClipboardList className="size-3.5" strokeWidth={1.75} /> To prepare <Lock className="size-3" strokeWidth={1.75} /> firm only
                      </p>
                      {h.prepNotes}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {data.hearings.length === 0 && <li className="text-label text-ink-muted">No past hearings recorded yet.</li>}
          </ol>
        </Card>
      </div>

      {outcomeOpen && (
        <OutcomeSheet
          c={c}
          onClose={() => setOutcomeOpen(false)}
          onSaved={() => {
            setOutcomeOpen(false)
            reload()
          }}
        />
      )}
      {linkOpen && <LinkSheet c={c} clientPhone={c.clientPhone} onClose={() => setLinkOpen(false)} />}
      {editing && (
        <EditNotes
          h={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </>
  )

  function BackLink() {
    return (
      <button onClick={() => navigate(-1)} className="mb-2 flex items-center gap-1.5 text-label font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.75} /> Back
      </button>
    )
  }
}

function Row({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-1.5 text-ink-muted">
        <Icon className="size-4" strokeWidth={1.75} /> {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function EditNotes({ h, onClose, onSaved }: { h: Hearing; onClose: () => void; onSaved: () => void }) {
  const [summary, setSummary] = useState(h.summary ?? '')
  const [share, setShare] = useState(h.shareWithClient)
  const [prepNotes, setPrepNotes] = useState(h.prepNotes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open title={`Hearing on ${formatDate(h.date)}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Textarea label="What happened in court" maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <label className="-mt-1 flex items-center gap-2 text-label">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Show this to the client on their page
        </label>
        <Textarea label="To prepare (firm only)" hint="Never shown to the client" maxLength={2000} value={prepNotes} onChange={(e) => setPrepNotes(e.target.value)} />
        {error && <Banner tone="stopped">{error}</Banner>}
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await api(`/hearings/${h.id}`, { method: 'PATCH', body: { summary, shareWithClient: share, prepNotes } })
              onSaved()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not save')
            } finally {
              setBusy(false)
            }
          }}
        >
          Save
        </Button>
      </div>
    </Sheet>
  )
}
