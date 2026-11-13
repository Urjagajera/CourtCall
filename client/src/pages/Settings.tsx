import { BellRing, Compass, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pushState, turnOffPush, turnOnPush, type PushState } from '../lib/push'
import { useTour } from '../components/Tour'
import { firstName, markTourSeen } from '../lib/tour'
import { tourStepsFor } from '../lib/tourSteps'
import { PageHeader } from '../components/AppLayout'
import { Button, Card, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useTheme, type ThemePref } from '../lib/theme'

const OPTIONS: [ThemePref, string, typeof Sun][] = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
  ['system', 'System', Monitor],
]

export default function Settings() {
  const { user, office, logout } = useAuth()
  const { pref, setPref } = useTheme()
  const tour = useTour()

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-xl flex-col gap-4">
        <Card>
          <p className="text-h2">{user!.name}</p>
          <p className="text-label text-ink-muted">
            {user!.email} ·{' '}
            {{ lawyer: 'Senior lawyer', junior: 'Junior lawyer', staff: 'Office staff', admin: 'Admin' }[user!.role]}
            {user!.isFirmAdmin && ' · Firm admin'}
            {office && ` · ${office.name}`}
          </p>
        </Card>
        <Card>
          <p className="mb-3 text-h2">Appearance</p>
          <div className="grid grid-cols-3 gap-2">
            {OPTIONS.map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setPref(value)}
                aria-pressed={pref === value}
                className={cx(
                  'flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-label font-medium',
                  pref === value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-raised text-ink',
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </Card>
        {user!.role !== 'admin' && <PhoneAlertsCard />}
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-h2">Guided tour</p>
            <p className="text-label text-ink-muted">See where everything is and what each feature does.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Compass className="size-4" strokeWidth={1.75} />}
            onClick={() => tour.start(tourStepsFor(user!.role, firstName(user!.name), user!.isFirmAdmin), () => markTourSeen(user!))}
          >
            Take the tour again
          </Button>
        </Card>
        <Button variant="secondary" onClick={logout} icon={<LogOut className="size-5" strokeWidth={1.75} />}>
          Sign out
        </Button>
      </div>
    </>
  )
}

/** Phone / browser alerts for this person's cases: client 2 away, being heard, hearing over. One per browser. */
function PhoneAlertsCard() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    pushState('staff').then(setState).catch(() => setState('off'))
  }, [])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      setState(state === 'on' ? await turnOffPush('staff') : await turnOnPush('staff'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change phone alerts')
    } finally {
      setBusy(false)
    }
  }

  const note =
    state === 'unsupported'
      ? 'This browser cannot show alerts. On iPhone, add CourtCall to the Home Screen first.'
      : state === 'blocked'
        ? 'Alerts are blocked for this site. Allow notifications in the browser settings, then come back.'
        : state === 'on'
          ? 'On for this device. You also see these alerts as a pop-up while CourtCall is open.'
          : 'Get a notification when a client of yours is 2 away, being heard, and when the hearing is over.'

  return (
    <Card data-tour="staff-alerts" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-h2">Phone alerts</p>
          <p className="text-label text-ink-muted">{note}</p>
          {error && <p className="mt-1 text-label text-stopped-fg">{error}</p>}
        </div>
      </div>
      {state !== null && state !== 'unsupported' && state !== 'blocked' && (
        <Button variant={state === 'on' ? 'secondary' : 'primary'} size="sm" onClick={toggle} disabled={busy}>
          {state === 'on' ? 'Turn off' : 'Turn on'}
        </Button>
      )}
    </Card>
  )
}
