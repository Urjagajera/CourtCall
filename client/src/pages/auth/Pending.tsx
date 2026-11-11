import { Hourglass, LogOut, RefreshCw, XCircle } from 'lucide-react'
import { Banner, Button } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { AuthLayout } from './AuthLayout'

export default function Pending() {
  const { user, logout, refresh } = useAuth()
  const rejected = user?.verificationStatus === 'rejected'
  const isJunior = user?.role === 'junior'

  return (
    <AuthLayout title={rejected ? 'Verification declined' : 'Awaiting verification'}>
      <div className="flex flex-col gap-4">
        <Banner tone={rejected ? 'stopped' : 'waiting'}>
          <span className="flex items-start gap-2">
            {rejected ? (
              <XCircle className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
            ) : (
              <Hourglass className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
            )}
            {rejected
              ? 'Your account could not be verified. Please contact CourtCall support.'
              : isJunior
                ? 'Your senior lawyer needs to approve you before you can join courtrooms.'
                : 'We are checking your Bar Council details. This is usually done within a few hours.'}
          </span>
        </Banner>
        <p className="text-label text-ink-muted">Signed in as {user?.email}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={refresh} icon={<RefreshCw className="size-5" strokeWidth={1.75} />}>
            Check again
          </Button>
          <Button variant="ghost" onClick={logout} icon={<LogOut className="size-5" strokeWidth={1.75} />}>
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
