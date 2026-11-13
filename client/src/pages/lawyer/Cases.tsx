import { CalendarDays, Hash, Landmark, Link2, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { TeamFields, type Team } from '../../components/CaseTeam'
import { HearingsToUpdate } from '../../components/HearingsToUpdate'
import { LinkSheet } from '../../components/LinkSheet'
import { Sheet } from '../../components/Sheet'
import { Banner, Button, Card, EmptyState, Input, PageSpinner, Select } from '../../components/ui'
import { api, type Case, type Client } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDate, todayISO } from '../../lib/dates'
import { useApi } from '../../lib/useApi'
import { useForm } from '../../lib/useForm'

export default function Cases() {
  const { user } = useAuth()
  // New cases: firm admins and senior lawyers. Edit/delete per case comes from the server (canEdit).
  const canAdd = user!.role === 'lawyer'
  const { data, error, loading, reload } = useApi<{ cases: Case[] }>('/cases')
  const [editing, setEditing] = useState<Case | 'new' | null>(null)
  // ?new=<clientId> (from a client's page) opens the add-case form for that client.
  const [params, setParams] = useSearchParams()
  const newFor = params.get('new')
  useEffect(() => {
    if (newFor && canAdd) setEditing('new')
  }, [newFor, canAdd])

  const byDate = useMemo(() => {
    const groups = new Map<string, Case[]>()
    for (const c of data?.cases ?? []) {
      if (c.hearingDate < todayISO() || c.status === 'closed') continue // past and closed: on the case pages and Calendar
      groups.set(c.hearingDate, [...(groups.get(c.hearingDate) ?? []), c])
    }
    return [...groups.entries()]
  }, [data])

  const [deleting, setDeleting] = useState<Case | null>(null)
  const remove = (c: Case) => setDeleting(c)
  const [sharing, setSharing] = useState<Case | null>(null)
  // Client phone numbers for the WhatsApp share button.
  const clientList = useApi<{ clients: Client[] }>('/clients')

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle="Your upcoming hearings by date. Tap a case for its full details, team and history."
        action={
          canAdd && (
            <Button data-tour="add-case" onClick={() => setEditing('new')} icon={<Plus className="size-5" strokeWidth={1.75} />}>
              Add case
            </Button>
          )
        }
      />
      {error && <Banner tone="stopped">{error}</Banner>}
      <HearingsToUpdate onChanged={reload} />
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
                  <Card key={c.id} className="flex min-w-0 items-start gap-3">
                    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md bg-accent text-accent-ink">
                      <span className="text-caption">Item</span>
                      <span className="tabular text-h2 font-bold leading-none">{c.itemNo ?? '—'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/cases/${c.id}`} className="block truncate text-body font-semibold hover:underline">
                        {c.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-2 text-label text-ink-muted">
                        <span className="flex items-center gap-1">
                          <UserRound className="size-3.5 shrink-0" strokeWidth={1.75} /> {c.clientName}
                        </span>
                        {c.caseNo && (
                          <span className="flex items-center gap-1 break-all">
                            <Hash className="size-3.5 shrink-0" strokeWidth={1.75} /> {c.caseNo}
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1 text-label text-ink-muted">
                        <Landmark className="size-3.5" strokeWidth={1.75} /> {c.courtComplex} · Court {c.roomNo}
                      </p>
                    </div>
                    <div className="flex">
                        <Button
                          data-tour={c === list[0] ? 'client-link' : undefined}
                          variant="ghost"
                          size="sm"
                          aria-label="Client links"
                          title="Share a private link with the client"
                          onClick={() => setSharing(c)}
                        >
                          <Link2 className="size-4" strokeWidth={1.75} />
                        </Button>
                        {c.canEdit && (
                          <>
                            <Button variant="ghost" size="sm" aria-label="Edit case" onClick={() => setEditing(c)}>
                              <Pencil className="size-4" strokeWidth={1.75} />
                            </Button>
                            <Button variant="ghost" size="sm" aria-label="Delete case" onClick={() => remove(c)}>
                              <Trash2 className="size-4" strokeWidth={1.75} />
                            </Button>
                          </>
                        )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CalendarDays className="size-10" strokeWidth={1.5} />} title="No upcoming hearings">
            {canAdd ? 'Add a case with its courtroom, date and item number from the cause list.' : 'Cases you are put on by your firm appear here.'}
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

      {sharing && (
        <LinkSheet
          c={sharing}
          clientPhone={clientList.data?.clients.find((x) => x.id === sharing.clientId)?.phone ?? null}
          onClose={() => setSharing(null)}
        />
      )}

      {editing && (
        <CaseForm
          key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? null : editing}
          clientId={editing === 'new' ? newFor : null}
          onClose={() => {
            setEditing(null)
            if (newFor) setParams({})
          }}
          onSaved={() => {
            setEditing(null)
            if (newFor) setParams({})
            reload()
          }}
        />
      )}
    </>
  )
}

function CaseForm({ existing, clientId, onClose, onSaved }: { existing: Case | null; clientId?: string | null; onClose: () => void; onSaved: () => void }) {
  const clients = useApi<{ clients: Client[] }>('/clients')
  const { user } = useAuth()
  // Team only when adding; afterwards it's changed from the case page (Case team).
  const [team, setTeam] = useState<Team>({ mainLawyerId: user!.id, assignedJuniorId: '', helperStaffId: '' })

  const { field, submit, submitting, formError } = useForm({
    clientId: existing?.clientId ?? clientId ?? '',
    title: existing?.title ?? '',
    caseNo: existing?.caseNo ?? '',
    courtComplex: existing?.courtComplex ?? '',
    roomNo: existing?.roomNo ?? '',
    hearingDate: existing?.hearingDate ?? todayISO(),
    itemNo: existing?.itemNo != null ? String(existing.itemNo) : '',
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
              itemNo: v.itemNo ? Number(v.itemNo) : null,
              ...(existing
                ? {}
                : {
                    mainLawyerId: team.mainLawyerId,
                    assignedJuniorId: team.assignedJuniorId || null,
                    helperStaffId: team.helperStaffId || null,
                  }),
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
        <Input label="Case number" required placeholder="e.g. CR.MA/1234/2026" hint="Needed before the client link can be shared" {...field('caseNo')} />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input label="Court complex" required placeholder="e.g. Gujarat High Court" {...field('courtComplex')} />
          <Input label="Court no." required placeholder="4" {...field('roomNo')} />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input label="Next hearing date" type="date" required {...field('hearingDate')} />
          <Input label="Item no." type="number" inputMode="numeric" min={1} placeholder="Later" className="tabular" {...field('itemNo')} />
        </div>
        {!existing && (
          <div className="rounded-md border border-line bg-surface-raised p-3">
            <p className="mb-2 text-label font-semibold">Case team</p>
            <TeamFields value={team} onChange={setTeam} canChangeMain={user!.isFirmAdmin} />
          </div>
        )}
        <Button type="submit" loading={submitting}>
          {existing ? 'Save changes' : 'Add case'}
        </Button>
      </form>
    </Sheet>
  )
}
