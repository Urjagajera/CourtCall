import { Briefcase, ChevronRight, ClipboardList, Crown, Loader2, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui'
import { api, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'

interface DemoAccount {
  key: string
  label: string
  name: string
  description: string
}

const ICONS: Record<string, LucideIcon> = {
  lawyer: Crown,
  lawyer2: Briefcase,
  lawyer3: Briefcase,
  junior: Users,
  junior2: Users,
  staff: ClipboardList,
  admin: ShieldCheck,
}

/** One-tap sign-in for each demo user type. Shown only when the server has DEMO_LOGIN=true. */
export function DemoLogins() {
  const [accounts, setAccounts] = useState<DemoAccount[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { setSession } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api<{ enabled: boolean; accounts: DemoAccount[] }>('/auth/demo')
      .then((r) => setAccounts(r.enabled ? r.accounts : []))
      .catch(() => setAccounts([]))
  }, [])

  if (!accounts.length) return null

  async function signIn(key: string) {
    setBusy(key)
    setError(null)
    try {
      const { user } = await api<{ user: User }>('/auth/demo', { body: { account: key } })
      await setSession(user)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo sign-in failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="demo-heading" className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 id="demo-heading" className="flex items-center gap-2 text-h2">
        <Sparkles className="size-5" strokeWidth={1.75} /> Try a demo account
      </h2>
      <p className="mt-1 text-label text-ink-muted">One tap, no password. Every role uses sample data.</p>
      {error && (
        <div className="mt-3">
          <Banner tone="stopped">{error}</Banner>
        </div>
      )}
      <ul className="mt-4 flex flex-col gap-2">
        {accounts.map((a) => {
          const Icon = ICONS[a.key] ?? Briefcase
          return (
            <li key={a.key}>
              <button
                onClick={() => signIn(a.key)}
                disabled={busy !== null}
                className="flex w-full items-center gap-3 rounded-md border border-line bg-surface-raised p-3 text-left transition-colors hover:border-accent disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-base text-ink">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-semibold">
                    {a.label} <span className="font-normal text-ink-muted">· {a.name}</span>
                  </span>
                  <span className="block text-caption text-ink-muted">{a.description}</span>
                </span>
                {busy === a.key ? (
                  <Loader2 className="size-5 shrink-0 animate-spin" strokeWidth={1.75} aria-label="Signing in" />
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-ink-muted" strokeWidth={1.75} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-caption text-ink-muted">The client view (private WhatsApp link) is added in the next update.</p>
    </section>
  )
}
