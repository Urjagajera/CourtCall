import { LogIn } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Banner, Button, Input } from '../../components/ui'
import { api, type User } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useForm } from '../../lib/useForm'
import { AuthLayout } from './AuthLayout'

export default function Login() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const { field, submit, submitting, formError } = useForm({ email: '', password: '' })

  return (
    <AuthLayout title="Sign in" subtitle="For lawyers and junior lawyers">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit(async (v) => {
            const { user } = await api<{ user: User }>('/auth/login', { body: v })
            await setSession(user)
            navigate('/')
          })
        }}
      >
        {formError && <Banner tone="stopped">{formError}</Banner>}
        <Input label="Email" type="email" autoComplete="email" required {...field('email')} />
        <Input label="Password" type="password" autoComplete="current-password" required {...field('password')} />
        <Button type="submit" loading={submitting} icon={<LogIn className="size-5" strokeWidth={1.75} />}>
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-label text-ink-muted">
        New to CourtCall?{' '}
        <Link to="/signup" className="font-semibold text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
