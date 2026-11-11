import { Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/AppLayout'
import { Sheet } from '../../components/Sheet'
import { Banner, Button, Card, EmptyState, Input, PageSpinner, Select } from '../../components/ui'
import { api, type Client } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useForm } from '../../lib/useForm'

const LANG = { en: 'English', hi: 'Hindi', gu: 'Gujarati' } as const

export default function Clients() {
  const { data, error, loading, reload } = useApi<{ clients: Client[] }>('/clients')
  const [editing, setEditing] = useState<Client | 'new' | null>(null)

  async function remove(c: Client) {
    if (!confirm(`Delete ${c.name} and all their cases? This cannot be undone.`)) return
    await api(`/clients/${c.id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Private to your office"
        action={
          <Button onClick={() => setEditing('new')} icon={<Plus className="size-5" strokeWidth={1.75} />}>
            Add client
          </Button>
        }
      />
      {error && <Banner tone="stopped">{error}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : data?.clients.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.clients.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-base text-ink">
                <UserRound className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold">{c.name}</p>
                <p className="flex items-center gap-1 text-label text-ink-muted">
                  {c.phone && (
                    <>
                      <Phone className="size-3.5" strokeWidth={1.75} /> {c.phone} ·{' '}
                    </>
                  )}
                  {LANG[c.language]}
                </p>
              </div>
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

      {editing && (
        <ClientForm
          client={editing === 'new' ? null : editing}
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
