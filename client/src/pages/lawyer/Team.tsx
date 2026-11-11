import { Briefcase, Check, ClipboardList, Copy, Crown, KeyRound, RefreshCw, ShieldCheck, UserMinus, UserPlus, Users, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/AppLayout'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Badge, Banner, Button, Card, EmptyState, PageSpinner, cx } from '../../components/ui'
import { api, type Office, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useApi } from '../../lib/useApi'

type Member = Pick<User, 'id' | 'name' | 'role' | 'isFirmAdmin' | 'verificationStatus'> & Partial<User>
type FirmRole = 'lawyer' | 'junior' | 'staff'

const ROLE: Record<FirmRole, { label: string; plural: string; icon: LucideIcon; can: string }> = {
  lawyer: { label: 'Senior lawyer', plural: 'Senior lawyers', icon: Briefcase, can: 'Clients, cases, courtrooms, client chat' },
  junior: { label: 'Junior lawyer', plural: 'Junior lawyers', icon: Users, can: 'Joins courtrooms and reports progress' },
  staff: { label: 'Office staff', plural: 'Office staff', icon: ClipboardList, can: 'Cases, clients, client chat; courtrooms read-only' },
}

export default function Team() {
  const { user, refresh } = useAuth()
  const { data, error, loading, reload } = useApi<{ office: Office & { ownerId: string }; members: Member[] }>('/office')
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState<Member | null>(null)
  const [rotating, setRotating] = useState(false)
  const admin = user!.isFirmAdmin

  async function act(fn: () => Promise<unknown>) {
    setActionError(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update')
    }
  }
  const verify = (m: Member, status: 'verified' | 'rejected') => act(() => api(`/office/members/${m.id}/verification`, { body: { status } }))
  const patch = (m: Member, body: { role?: FirmRole; isFirmAdmin?: boolean }) => act(() => api(`/office/members/${m.id}`, { method: 'PATCH', body }))

  const members = data?.members ?? []
  const pending = members.filter((m) => m.verificationStatus === 'pending')
  const active = members.filter((m) => m.verificationStatus === 'verified')
  const inactive = members.filter((m) => m.verificationStatus === 'rejected')
  const count = (r: FirmRole) => active.filter((m) => m.role === r).length

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={admin ? 'You are a firm admin: you manage everyone in the firm' : `Everyone at ${data?.office.name ?? 'your firm'}`}
      />
      {(error || actionError) && <Banner tone="stopped">{error ?? actionError}</Banner>}
      {loading && !data ? (
        <PageSpinner />
      ) : data ? (
        <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            {admin ? (
              <Card data-tour="invite-code">
                <p className="flex items-center gap-2 text-h2">
                  <KeyRound className="size-5" strokeWidth={1.75} /> Firm invite code
                </p>
                <p className="mt-1 text-label text-ink-muted">
                  Senior lawyers, juniors and office staff sign up with this code and choose their role. You approve them here.
                </p>
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
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRotating(true)} icon={<RefreshCw className="size-4" strokeWidth={1.75} />}>
                  Make a new code
                </Button>
              </Card>
            ) : (
              <Card data-tour="invite-code">
                <p className="flex items-center gap-2 text-h2">
                  <Crown className="size-5" strokeWidth={1.75} /> Firm admins
                </p>
                <p className="mt-1 text-label text-ink-muted">Ask a firm admin to add people, change roles or share the invite code.</p>
                <ul className="mt-3 flex flex-col gap-1 text-label font-semibold">
                  {active.filter((m) => m.isFirmAdmin).map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Firm at a glance */}
            <Card>
              <p className="mb-3 text-h2">Your firm</p>
              <ul className="flex flex-col gap-3">
                {(Object.keys(ROLE) as FirmRole[]).map((r) => {
                  const R = ROLE[r]
                  return (
                    <li key={r} className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-base">
                        <R.icon className="size-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-label font-semibold">{R.plural}</span>
                        <span className="block text-caption text-ink-muted">{R.can}</span>
                      </span>
                      <span className="tabular text-h2">{count(r)}</span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {admin && pending.length > 0 && (
              <Card data-tour="team-pending" className="border-waiting-fg/40">
                <p className="mb-1 flex items-center gap-2 text-h2">
                  <UserPlus className="size-5" strokeWidth={1.75} /> Waiting for your approval
                  <Badge tone="waiting">{pending.length}</Badge>
                </p>
                <p className="mb-2 text-label text-ink-muted">Check that you know each person before approving. Approved people see the firm's clients and cases.</p>
                <ul className="divide-y divide-line">
                  {pending.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Person m={m} ownerId={data.office.ownerId} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => verify(m, 'verified')} icon={<Check className="size-4" strokeWidth={1.75} />}>
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => verify(m, 'rejected')} icon={<X className="size-4" strokeWidth={1.75} />}>
                          Decline
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card data-tour="team-members">
              <p className="mb-2 text-h2">People</p>
              {active.length ? (
                <ul className="divide-y divide-line">
                  {active.map((m) => {
                    const self = m.id === user!.id
                    const founder = m.id === data.office.ownerId
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                        <Person m={m} ownerId={data.office.ownerId} self={self} />
                        {admin && !self && (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="sr-only" htmlFor={`role-${m.id}`}>
                              Role for {m.name}
                            </label>
                            <select
                              id={`role-${m.id}`}
                              value={m.role}
                              disabled={founder}
                              onChange={(e) => patch(m, { role: e.target.value as FirmRole })}
                              className="h-9 rounded-md border border-line bg-surface-raised px-2 text-label disabled:opacity-60"
                            >
                              {(Object.keys(ROLE) as FirmRole[]).map((r) => (
                                <option key={r} value={r}>
                                  {ROLE[r].label}
                                </option>
                              ))}
                            </select>
                            {m.role !== 'junior' && !founder && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => patch(m, { isFirmAdmin: !m.isFirmAdmin })}
                                icon={<Crown className="size-4" strokeWidth={1.75} />}
                              >
                                {m.isFirmAdmin ? 'Remove admin' : 'Make admin'}
                              </Button>
                            )}
                            {!founder && (
                              <Button size="sm" variant="ghost" onClick={() => setDeactivating(m)} icon={<UserMinus className="size-4" strokeWidth={1.75} />}>
                                Deactivate
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState icon={<Users className="size-10" strokeWidth={1.5} />} title="Just you so far">
                  Share the invite code with your lawyers, juniors and staff.
                </EmptyState>
              )}
            </Card>

            {admin && inactive.length > 0 && (
              <Card>
                <p className="mb-2 text-h2 text-ink-muted">Deactivated or declined</p>
                <ul className="divide-y divide-line">
                  {inactive.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 opacity-80">
                      <Person m={m} ownerId={data.office.ownerId} />
                      <Button size="sm" variant="secondary" onClick={() => verify(m, 'verified')} icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}>
                        Reactivate
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmSheet
        open={!!deactivating}
        title={`Deactivate ${deactivating?.name ?? ''}?`}
        message="They will lose access to the firm's clients, cases, chats and courtrooms straight away. You can reactivate them later."
        confirmLabel="Deactivate"
        onClose={() => setDeactivating(null)}
        onConfirm={async () => {
          await api(`/office/members/${deactivating!.id}/verification`, { body: { status: 'rejected' } })
          reload()
        }}
      />
      <ConfirmSheet
        open={rotating}
        title="Make a new invite code?"
        message="The current code stops working immediately. People who already joined are not affected."
        confirmLabel="Make new code"
        onClose={() => setRotating(false)}
        onConfirm={async () => {
          await api('/office/invite-code', { method: 'POST' })
          reload()
          refresh()
        }}
      />
    </>
  )
}

function Person({ m, ownerId, self }: { m: Member; ownerId: string; self?: boolean }) {
  const R = ROLE[(m.role as FirmRole) in ROLE ? (m.role as FirmRole) : 'lawyer']
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', m.isFirmAdmin ? 'bg-accent text-accent-ink' : 'bg-base')}>
        <R.icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-body font-semibold">
          {m.name}
          {self && <span className="text-caption font-normal text-ink-muted">(you)</span>}
          {m.isFirmAdmin && (
            <Badge tone="info" icon={<Crown className="size-3.5" strokeWidth={1.75} />}>
              Firm admin
            </Badge>
          )}
          {m.id === ownerId && <Badge tone="stale">Founder</Badge>}
        </p>
        <p className="truncate text-label text-ink-muted">
          {R.label}
          {m.email && ` · ${m.email}`}
          {m.phone && ` · ${m.phone}`}
        </p>
      </div>
    </div>
  )
}
