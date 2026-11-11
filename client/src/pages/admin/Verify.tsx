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
      <PageHeader title="CourtCall verification" subtitle="For the CourtCall team, not for law firms" />
      {/* Plain-language explanation: this page is the platform's gatekeeper, not a firm admin page. */}
      <Card className="mb-5 grid gap-4 md:grid-cols-3">
        {[
          { n: 1, t: 'A senior lawyer signs up', d: 'They enter their Bar Council enrolment number.' },
          { n: 2, t: 'You check the number', d: 'Compare it with the Bar Council roll before deciding.' },
          { n: 3, t: 'Verify or reject', d: 'Only verified lawyers can open courtrooms, add clients and invite juniors.' },
        ].map((s) => (
          <div key={s.n} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-label font-bold text-accent-ink">{s.n}</span>
            <div>
              <p className="text-label font-semibold">{s.t}</p>
              <p className="text-caption text-ink-muted">{s.d}</p>
            </div>
          </div>
        ))}
        <p className="flex items-center gap-2 text-caption text-ink-muted md:col-span-3">
          <ShieldCheck className="size-4 shrink-0 text-detail" strokeWidth={1.75} />
          Juniors are approved by their own firm on its Team page, not here. This keeps fake lawyers out of shared courtrooms.
        </p>
      </Card>
      <div data-tour="verify-tabs" className="mb-4 inline-flex gap-1 rounded-md border border-line bg-surface p-1">
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
        <div data-tour="verify-list" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
