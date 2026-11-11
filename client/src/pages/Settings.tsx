import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { PageHeader } from '../components/AppLayout'
import { Button, Card, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useTheme, type ThemePref } from '../lib/theme'

const OPTIONS: [ThemePref, string, typeof Sun][] = [
  ['system', 'System', Monitor],
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
]

export default function Settings() {
  const { user, office, logout } = useAuth()
  const { pref, setPref } = useTheme()

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-xl flex-col gap-4">
        <Card>
          <p className="text-h2">{user!.name}</p>
          <p className="text-label text-ink-muted">
            {user!.email} · <span className="capitalize">{user!.role}</span>
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
        <Button variant="secondary" onClick={logout} icon={<LogOut className="size-5" strokeWidth={1.75} />}>
          Sign out
        </Button>
      </div>
    </>
  )
}
