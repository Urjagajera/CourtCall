import { CalendarDays, Hash, Landmark, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { Banner, Button, Card, EmptyState, Input, PageSpinner, Select } from '../../components/ui'
import { api, type Case, type Client, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDate, todayISO } from '../../lib/dates'
import { useApi } from '../../lib/useApi'
import { useForm } from '../../lib/useForm'

export default function Cases() {
  const { user } = useAuth()
  const isLawyer = user!.role === 'lawyer'
  const { data, error, loading, reload } = useApi<{ cases: Case[] }>('/cases')
  const [editing, setEditing] = useState<Case | 'new' | null>(null)

  const byDate = useMemo(() => {
    const groups = new Map<string, Case[]>()
    for (const c of data?.cases ?? []) {
      if (c.hearingDate < todayISO()) continue // past hearings hidden
      groups.set(c.hearingDate, [...(groups.get(c.hearingDate) ?? []), c])
    }
    return [...groups.entries()]
  }, [data])

  const [deleting, setDeleting] = useState<Case | null>(null)
  const remove = (c: Case) => setDeleting(c)

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle="Upcoming hearings by date"
        action={
          isLawyer && (
            <Button data-tour="add-case" onClick={() => setEditing('new')} icon={<Plus className="size-5" strokeWidth={1.75} />}>
              Add case
            </Button>
          )
        }
      />
      {error && <Banner tone="stopped">{error}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : byDate.length ? (
        <div className="flex flex-col gap-6">
          {byDate.map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-2 flex items-center gap-2 text-h2 text-ink">
                <CalendarDays className="size-5" strokeWidth={1.75} />
                {date === todayISO() ? 'Today' : formatDate(date)}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {list.map((c) => (
                  <Card key={c.id} className="flex items-start gap-3">
                    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md bg-accent text-accent-ink">
                      <span className="text-caption">Item</span>
                      <span className="tabular text-h2 font-bold leading-none">{c.itemNo}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold">{c.title}</p>
                      <p className="flex items-center gap-1 text-label text-ink-muted">
                        <UserRound className="size-3.5" strokeWidth={1.75} /> {c.clientName}
                        {c.caseNo && (
                          <>
                            <Hash className="ml-1 size-3.5" strokeWidth={1.75} /> {c.caseNo}
                          </>
                        )}
                      </p>
                      <p className="flex items-center gap-1 text-label text-ink-muted">
                        <Landmark className="size-3.5" strokeWidth={1.75} /> {c.courtComplex} · Court {c.roomNo}
                      </p>
                    </div>
                    {isLawyer && (
                      <div className="flex">
                        <Button variant="ghost" size="sm" aria-label="Edit case" onClick={() => setEditing(c)}>
                          <Pencil className="size-4" strokeWidth={1.75} />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Delete case" onClick={() => remove(c)}>
                          <Trash2 className="size-4" strokeWidth={1.75} />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CalendarDays className="size-10" strokeWidth={1.5} />} title="No upcoming hearings">
            {isLawyer ? 'Add a case with its courtroom, date and item number from the cause list.' : 'Your senior lawyer has not added any cases yet.'}
          </EmptyState>
        </Card>
      )}

      <ConfirmSheet
        open={!!deleting}
        title="Delete case?"
        message={`"${deleting?.title}" will be removed from your cases. This cannot be undone.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api(`/cases/${deleting!.id}`, { method: 'DELETE' })
          reload()
        }}
      />

      {editing && (
        <CaseForm
          key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function CaseForm({ existing, onClose, onSaved }: { existing: Case | null; onClose: () => void; onSaved: () => void }) {
  const clients = useApi<{ clients: Client[] }>('/clients')
  const team = useApi<{ members: User[] }>('/office')
  const juniors = (team.data?.members ?? []).filter((m) => m.role === 'junior' && m.verificationStatus === 'verified')

  const { field, submit, submitting, formError } = useForm({
    clientId: existing?.clientId ?? '',
    title: existing?.title ?? '',
    caseNo: existing?.caseNo ?? '',
    courtComplex: existing?.courtComplex ?? '',
    roomNo: existing?.roomNo ?? '',
    hearingDate: existing?.hearingDate ?? todayISO(),
    itemNo: existing ? String(existing.itemNo) : '',
    assignedJuniorId: existing?.assignedJuniorId ?? '',
  })

  if (clients.data && clients.data.clients.length === 0) {
    return (
      <Sheet open title="Add case" onClose={onClose}>
        <EmptyState icon={<UserRound className="size-10" strokeWidth={1.5} />} title="Add a client first">
          <Link to="/clients" className="font-semibold text-ink underline underline-offset-4">
            Go to Clients
          </Link>
        </EmptyState>
      </Sheet>
    )
  }

  return (
    <Sheet open title={existing ? 'Edit case' : 'Add case'} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit(async (v) => {
            const body = {
              ...v,
              caseNo: v.caseNo || undefined,
              itemNo: Number(v.itemNo),
              assignedJuniorId: v.assignedJuniorId || null,
            }
            await api(existing ? `/cases/${existing.id}` : '/cases', { method: existing ? 'PATCH' : 'POST', body })
            onSaved()
          })
        }}
      >
        {formError && <Banner tone="stopped">{formError}</Banner>}
        <Select label="Client" required {...field('clientId')}>
          <option value="" disabled>
            {clients.loading ? 'Loading…' : 'Choose a client'}
          </option>
          {clients.data?.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input label="Case title" required placeholder="e.g. Shah vs State of Gujarat" {...field('title')} />
        <Input label="Case number (optional)" placeholder="e.g. CR.MA/1234/2026" {...field('caseNo')} />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input label="Court complex" required placeholder="e.g. Gujarat High Court" {...field('courtComplex')} />
          <Input label="Court no." required placeholder="4" {...field('roomNo')} />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input label="Hearing date" type="date" required {...field('hearingDate')} />
          <Input label="Item no." type="number" inputMode="numeric" min={1} required className="tabular" {...field('itemNo')} />
        </div>
        <Select label="Junior in court (optional)" {...field('assignedJuniorId')}>
          <option value="">Not assigned</option>
          {juniors.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </Select>
        <Button type="submit" loading={submitting}>
          {existing ? 'Save changes' : 'Add case'}
        </Button>
      </form>
    </Sheet>
  )
}
