import { Check, Copy, KeyRound, ShieldCheck, Users, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/AppLayout'
import { Badge, Banner, Button, Card, EmptyState, PageSpinner } from '../../components/ui'
import { api, type Office, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useApi } from '../../lib/useApi'

export default function Team() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi<{ office: Office; members: User[] }>('/office')
  const [copied, setCopied] = useState(false)

  async function decide(id: string, status: 'verified' | 'rejected') {
    await api(`/office/juniors/${id}/verification`, { body: { status } })
    reload()
  }

  const juniors = data?.members.filter((m) => m.id !== user!.id) ?? []

  return (
    <>
      <PageHeader title="Team" subtitle="Juniors in your office" />
      {error && <Banner tone="stopped">{error}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card data-tour="invite-code">
            <p className="flex items-center gap-2 text-h2">
              <KeyRound className="size-5" strokeWidth={1.75} /> Office invite code
            </p>
            <p className="mt-1 text-label text-ink-muted">Juniors enter this code when they sign up. You approve them here.</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="tabular flex-1 rounded-md border border-line bg-surface-raised py-3 text-center text-h1 tracking-[0.3em]">
                {data.office.inviteCode}
              </span>
              <Button
                variant="secondary"
                aria-label="Copy invite code"
                onClick={async () => {
                  await navigator.clipboard.writeText(data.office.inviteCode!)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? <Check className="size-5" strokeWidth={1.75} /> : <Copy className="size-5" strokeWidth={1.75} />}
              </Button>
            </div>
          </Card>

          <Card>
            {juniors.length ? (
              <ul className="divide-y divide-line">
                {juniors.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold">{j.name}</p>
                      <p className="text-label text-ink-muted">
                        {j.phone} · {j.email}
                      </p>
                    </div>
                    {j.verificationStatus === 'pending' ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(j.id, 'verified')} icon={<Check className="size-4" strokeWidth={1.75} />}>
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => decide(j.id, 'rejected')} icon={<X className="size-4" strokeWidth={1.75} />}>
                          Decline
                        </Button>
                      </div>
                    ) : j.verificationStatus === 'verified' ? (
                      <Badge tone="hearing" icon={<ShieldCheck className="size-3.5" strokeWidth={1.75} />}>
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="stopped">Declined</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Users className="size-10" strokeWidth={1.5} />} title="No juniors yet">
                Share your invite code with your juniors.
              </EmptyState>
            )}
          </Card>
        </div>
      ) : null}
    </>
  )
}
