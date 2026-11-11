import { Briefcase, CalendarDays, LayoutDashboard, Settings, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Logo } from './Logo'
import { cx } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

function navFor(role: string): NavItem[] {
  if (role === 'admin') {
    return [
      { to: '/admin', label: 'Verify', icon: ShieldCheck },
      { to: '/settings', label: 'Settings', icon: Settings },
    ]
  }
  const items: NavItem[] = [
    { to: '/', label: 'Today', icon: LayoutDashboard },
    { to: '/cases', label: 'Cases', icon: CalendarDays },
  ]
  if (role === 'lawyer') {
    items.push({ to: '/clients', label: 'Clients', icon: Briefcase }, { to: '/team', label: 'Team', icon: Users })
  }
  items.push({ to: '/settings', label: 'Settings', icon: Settings })
  return items
}

export function AppLayout() {
  const { user, office } = useAuth()
  const items = navFor(user!.role)

  return (
    <div className="min-h-screen lg:flex">
      {/* Laptop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-body transition-colors',
                  isActive ? 'bg-accent font-semibold text-accent-ink' : 'text-ink hover:bg-surface-raised',
                )
              }
            >
              <Icon className="size-5" strokeWidth={1.75} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto text-label">
          <p className="font-semibold text-ink">{user!.name}</p>
          <p className="text-ink-muted">{office?.name ?? (user!.role === 'admin' ? 'Platform admin' : '')}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <Logo />
          <span className="truncate pl-4 text-label text-ink-muted">{office?.name}</span>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>

        {/* Phone bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex max-w-[480px]">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cx('relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-caption', isActive ? 'font-semibold text-ink' : 'text-ink-muted')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-accent" />}
                    <Icon className="size-6" strokeWidth={1.75} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-h1 text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-label text-ink">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
