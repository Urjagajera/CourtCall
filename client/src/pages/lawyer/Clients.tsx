import { Pencil, Phone, Plus, Trash2, UserCog, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/AppLayout'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Sheet } from '../../components/Sheet'
import { Banner, Button, Card, EmptyState, Input, PageSpinner, Select } from '../../components/ui'
import { api, type Client } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../../lib/auth'
import { AssigneePicker } from '../../components/AssigneePicker'

type Assignee = { id: string; name: string; role: string }
type ClientRow = Client & { assignees: Assignee[] }
import { useForm } from '../../lib/useForm'

const LANG = { en: 'English', hi: 'Hindi', gu: 'Gujarati' } as const

export default function Clients() {
  const { data, error, loading, reload } = useApi<{ clients: ClientRow[] }>('/clients')
  const { user } = useAuth()
  const [assigning, setAssigning] = useState<ClientRow | null>(null)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)

  const [deleting, setDeleting] = useState<Client | null>(null)
  const remove = (c: Client) => setDeleting(c)

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={user!.isFirmAdmin ? 'Every client of your firm' : 'Clients assigned to you'}
        action={
          <Button data-tour="add-client" onClick={() => setEditing('new')} icon={<Plus className="size-5" strokeWidth={1.75} />}>
            Add client
          </Button>
        }
      />
      {error && <Banner tone="stopped">{error}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : data?.clients.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.clients.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-base text-ink">
                <UserRound className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <Link to={`/clients/${c.id}`} className="block truncate text-body font-semibold hover:underline">
                  {c.name}
                </Link>
                <p className="flex items-center gap-1 text-label text-ink-muted">
                  {c.phone && (
                    <>
                      <Phone className="size-3.5" strokeWidth={1.75} /> {c.phone} ·{' '}
                    </>
                  )}
                  {LANG[c.language]}
                </p>
                <p className="truncate text-caption text-ink-muted">
                  {c.assignees.length ? `Looked after by ${c.assignees.map((a) => a.name).join(', ')}` : 'Not assigned yet (firm admins only)'}
                </p>
              </div>
              {user!.isFirmAdmin && (
                <Button variant="ghost" size="sm" aria-label={`Who looks after ${c.name}`} onClick={() => setAssigning(c)}>
                  <UserCog className="size-4" strokeWidth={1.75} />
                </Button>
              )}
              <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                <Pencil className="size-4" strokeWidth={1.75} />
              </Button>
              <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>
                <Trash2 className="size-4" strokeWidth={1.75} />
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<UserRound className="size-10" strokeWidth={1.5} />} title="No clients yet">
            Add a client, then map their case to a courtroom.
          </EmptyState>
        </Card>
      )}

      <ConfirmSheet
        open={!!deleting}
        title="Delete client?"
        message={`${deleting?.name} and all of their cases will be deleted. This cannot be undone.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api(`/clients/${deleting!.id}`, { method: 'DELETE' })
          reload()
        }}
      />

      {editing && (
        <ClientForm
          key={editing === 'new' ? 'new' : editing.id}
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {assigning && <AssignSheet client={assigning} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); reload() }} />}
    </>
  )
}

function ClientForm({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const { field, submit, submitting, formError } = useForm({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    language: client?.language ?? 'en',
  })

  return (
    <Sheet open title={client ? 'Edit client' : 'Add client'} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit(async (v) => {
            const body = { name: v.name, phone: v.phone || undefined, language: v.language }
            await api(client ? `/clients/${client.id}` : '/clients', { method: client ? 'PATCH' : 'POST', body })
            onSaved()
          })
        }}
      >
        {formError && <Banner tone="stopped">{formError}</Banner>}
        <Input label="Client name" required {...field('name')} />
        <Input label="WhatsApp number" type="tel" inputMode="tel" hint="Used to share their private case link" {...field('phone')} />
        <Select label="Alert language" {...field('language')}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="gu">Gujarati</option>
        </Select>
        <Button type="submit" loading={submitting}>
          {client ? 'Save changes' : 'Add client'}
        </Button>
      </form>
    </Sheet>
  )
}

/** Firm admins: choose which lawyers and staff look after a client. */
function AssignSheet({ client, onClose, onSaved }: { client: ClientRow; onClose: () => void; onSaved: () => void }) {
  const [ids, setIds] = useState(client.assignees.map((a) => a.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open title={`Who looks after ${client.name}`} onClose={onClose}>
      <AssigneePicker value={ids} onChange={setIds} />
      {error && <Banner tone="stopped">{error}</Banner>}
      <Button
        className="mt-4 w-full"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await api(`/clients/${client.id}/assignees`, { method: 'PUT', body: { userIds: ids } })
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
    </Sheet>
  )
}
