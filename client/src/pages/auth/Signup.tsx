import { Briefcase, Building2, ClipboardList, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banner, Button, Input, cx } from '../../components/ui'
import { api, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useForm } from '../../lib/useForm'
import { AuthLayout } from './AuthLayout'

type Mode = 'create' | 'join'
type JoinRole = 'lawyer' | 'junior' | 'staff'

const JOIN_ROLES: { role: JoinRole; label: string; icon: LucideIcon }[] = [
  { role: 'lawyer', label: 'Senior lawyer', icon: Briefcase },
  { role: 'junior', label: 'Junior lawyer', icon: Users },
  { role: 'staff', label: 'Office staff', icon: ClipboardList },
]

export default function Signup() {
  const [mode, setMode] = useState<Mode>('create')
  const [role, setRole] = useState<JoinRole>('junior')
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const { field, submit, submitting, formError } = useForm({
    name: '',
    email: '',
    phone: '',
    password: '',
    barCouncilNo: '',
    officeName: '',
    inviteCode: '',
  })

  return (
    <AuthLayout title="Create your account" subtitle="Start a new firm, or join the firm you work at">
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-line bg-surface-raised p-1">
        {(
          [
            ['create', 'Create a firm', Building2],
            ['join', 'Join a firm', UserPlus],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={cx(
              'flex h-11 items-center justify-center gap-2 rounded-sm text-label font-medium transition-colors',
              mode === k ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} /> {label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-label text-ink-muted">
        {mode === 'create'
          ? 'For the senior lawyer starting the firm. You become its first firm admin and can start right away.'
          : 'Ask a firm admin for the 6-character invite code. They approve you after you sign up.'}
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit(async (v) => {
            const common = { name: v.name, email: v.email, phone: v.phone, password: v.password }
            const { user } =
              mode === 'create'
                ? await api<{ user: User }>('/auth/register/lawyer', { body: { ...common, barCouncilNo: v.barCouncilNo || undefined, officeName: v.officeName } })
                : await api<{ user: User }>('/auth/register/member', {
                    body: { ...common, role, inviteCode: v.inviteCode, barCouncilNo: role === 'staff' ? undefined : v.barCouncilNo || undefined },
                  })
            await setSession(user)
            navigate('/')
          })
        }}
      >
        {formError && <Banner tone="stopped">{formError}</Banner>}

        {mode === 'join' && (
          <fieldset>
            <legend className="mb-2 text-label font-semibold">I am joining as</legend>
            <div className="grid grid-cols-3 gap-2">
              {JOIN_ROLES.map(({ role: r, label, icon: Icon }) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className={cx(
                    'flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-caption font-semibold transition-colors',
                    role === r ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-raised text-ink hover:border-accent',
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Input label="Full name" autoComplete="name" required {...field('name')} />
        <Input label="Email" type="email" autoComplete="email" required {...field('email')} />
        <Input label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" required {...field('phone')} />
        <Input label="Password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters" {...field('password')} />

        {mode === 'create' ? (
          <>
            <Input label="Bar Council enrolment no. (optional)" hint="Shown on your profile to your firm" {...field('barCouncilNo')} />
            <Input label="Firm / chamber name" required placeholder="e.g. Mehta & Associates" {...field('officeName')} />
          </>
        ) : (
          <>
            <Input
              label="Firm invite code"
              required
              maxLength={6}
              placeholder="6 characters"
              className="uppercase tracking-[0.3em]"
              hint="Your firm admin shares this code"
              {...field('inviteCode')}
            />
            {role !== 'staff' && (
              <Input
                label="Bar Council enrolment no. (optional)"
                {...field('barCouncilNo')}
              />
            )}
          </>
        )}
        <Button type="submit" loading={submitting} icon={<UserPlus className="size-5" strokeWidth={1.75} />}>
          {mode === 'create' ? 'Create firm and account' : 'Request to join'}
        </Button>
      </form>
      <p className="mt-5 text-center text-label text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
