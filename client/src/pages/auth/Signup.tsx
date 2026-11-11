import { Briefcase, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banner, Button, Input, cx } from '../../components/ui'
import { api, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useForm } from '../../lib/useForm'
import { AuthLayout } from './AuthLayout'

type Kind = 'lawyer' | 'junior'

export default function Signup() {
  const [kind, setKind] = useState<Kind>('lawyer')
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
    <AuthLayout title="Create your account" subtitle="Accounts are verified before courtroom access">
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-line bg-surface-raised p-1">
        {(
          [
            ['lawyer', 'Senior lawyer', Briefcase],
            ['junior', 'Junior lawyer', Users],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              'flex h-11 items-center justify-center gap-2 rounded-sm text-label font-medium transition-colors',
              kind === k ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} /> {label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit(async (v) => {
            const body =
              kind === 'lawyer'
                ? { name: v.name, email: v.email, phone: v.phone, password: v.password, barCouncilNo: v.barCouncilNo, officeName: v.officeName }
                : {
                    name: v.name,
                    email: v.email,
                    phone: v.phone,
                    password: v.password,
                    barCouncilNo: v.barCouncilNo || undefined,
                    inviteCode: v.inviteCode,
                  }
            const { user } = await api<{ user: User }>(`/auth/register/${kind}`, { body })
            await setSession(user)
            navigate('/')
          })
        }}
      >
        {formError && <Banner tone="stopped">{formError}</Banner>}
        <Input label="Full name" autoComplete="name" required {...field('name')} />
        <Input label="Email" type="email" autoComplete="email" required {...field('email')} />
        <Input label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" required {...field('phone')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters"
          {...field('password')}
        />
        {kind === 'lawyer' ? (
          <>
            <Input label="Bar Council enrolment no." required hint="Used to verify you manually" {...field('barCouncilNo')} />
            <Input label="Office / chamber name" required placeholder="e.g. Mehta & Associates" {...field('officeName')} />
          </>
        ) : (
          <>
            <Input
              label="Office invite code"
              required
              maxLength={6}
              placeholder="6 characters"
              className="uppercase tracking-[0.3em]"
              hint="Ask your senior lawyer for this code"
              {...field('inviteCode')}
            />
            <Input label="Bar Council enrolment no. (optional)" {...field('barCouncilNo')} />
          </>
        )}
        <Button type="submit" loading={submitting} icon={<UserPlus className="size-5" strokeWidth={1.75} />}>
          Create account
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
