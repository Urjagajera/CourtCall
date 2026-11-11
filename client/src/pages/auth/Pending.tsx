import { Hourglass, LogOut, RefreshCw, XCircle } from 'lucide-react'
import { Banner, Button } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { AuthLayout } from './AuthLayout'

export default function Pending() {
  const { user, logout, refresh } = useAuth()
  const rejected = user?.verificationStatus === 'rejected'
  // Firm founders are checked by CourtCall; everyone who joined a firm is approved by its firm admin.
  const joinedFirm = !user?.isFirmAdmin

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
              ? joinedFirm
                ? 'Your firm admin has declined or deactivated this account. Please contact them.'
                : 'This account was deactivated. Please contact your firm admin.'
              : joinedFirm
                ? 'A firm admin needs to approve you before you can see the firm’s cases and courtrooms.'
                : 'A firm admin needs to approve you before you can use CourtCall.'}
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
