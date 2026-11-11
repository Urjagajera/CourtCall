import { Check, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/AppLayout'
import { Banner, Button, Card, EmptyState, PageSpinner, cx } from '../../components/ui'
import { api, type User } from '../../lib/api'
import { useApi } from '../../lib/useApi'

type Status = 'pending' | 'verified' | 'rejected'
type Row = User & { officeName: string | null }

export default function Verify() {
  const [status, setStatus] = useState<Status>('pending')
  const { data, error, loading, reload } = useApi<{ lawyers: Row[] }>(`/admin/lawyers?status=${status}`)

  async function decide(id: string, next: 'verified' | 'rejected') {
    await api(`/admin/lawyers/${id}/verification`, { body: { status: next } })
    reload()
  }

  return (
    <>
      <PageHeader title="Lawyer verification" subtitle="Check Bar Council enrolment before approving" />
      <div className="mb-4 inline-flex gap-1 rounded-md border border-line bg-surface p-1">
        {(['pending', 'verified', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cx('h-10 rounded-sm px-4 text-label font-medium capitalize', status === s ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink')}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <Banner tone="stopped">{error}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : data?.lawyers.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.lawyers.map((l) => (
            <Card key={l.id}>
              <p className="text-body font-semibold">{l.name}</p>
              <p className="text-label text-ink-muted">{l.officeName}</p>
              <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-label">
                <dt className="text-ink-muted">Bar Council no.</dt>
                <dd className="font-semibold">{l.barCouncilNo}</dd>
                <dt className="text-ink-muted">Phone</dt>
                <dd>{l.phone}</dd>
                <dt className="text-ink-muted">Email</dt>
                <dd className="truncate">{l.email}</dd>
              </dl>
              {status === 'pending' && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => decide(l.id, 'verified')} icon={<Check className="size-4" strokeWidth={1.75} />}>
                    Verify
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(l.id, 'rejected')} icon={<X className="size-4" strokeWidth={1.75} />}>
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ShieldCheck className="size-10" strokeWidth={1.5} />} title={`No ${status} lawyers`} />
        </Card>
      )}
    </>
  )
}
