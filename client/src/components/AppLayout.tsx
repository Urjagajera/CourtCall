import { Briefcase, CalendarDays, FolderOpen, LayoutDashboard, MessageCircle, Settings, Users, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { startChat, useChat } from '../lib/nexconn'
import { firstName, markTourSeen, tourSeen } from '../lib/tour'
import { tourStepsFor } from '../lib/tourSteps'
import { useTour } from './Tour'
import { Logo } from './Logo'
import { cx } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

function navFor(role: string): NavItem[] {
  const items: NavItem[] = [
    { to: '/', label: 'Today', icon: LayoutDashboard },
    { to: '/cases', label: 'Cases', icon: FolderOpen },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/chats', label: 'Chat', icon: MessageCircle },
  ]
  if (role === 'lawyer' || role === 'staff') {
    items.push({ to: '/clients', label: 'Clients', icon: Briefcase }, { to: '/team', label: 'Team', icon: Users })
  }
  return items
}

export function AppLayout() {
  const { user, office } = useAuth()
  const chat = useChat()
  const items = navFor(user!.role)

  // Lawyers and juniors stay connected to Nexconn while signed in (live rooms + chat).
  useEffect(() => {
    if (user!.role !== 'admin') startChat()
  }, [user])

  // First login: start the guided tour once the first page has rendered.
  const tour = useTour()
  const userId = user!.id
  useEffect(() => {
    const u = user!
    if (tourSeen(u)) return
    const t = setTimeout(() => tour.start(tourStepsFor(u.role, firstName(u.name), u.isFirmAdmin), () => markTourSeen(u)), 900)
    return () => clearTimeout(t)
    // Only once per signed-in user, not on every profile refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const chatDot = user!.role !== 'admin' && (
    <span
      data-tour="live-dot"
      title={chat.status === 'ready' ? 'Live' : chat.status === 'error' ? (chat.error ?? 'Chat offline') : 'Connecting'}
      className={cx(
        'size-2.5 rounded-full',
        chat.status === 'ready' ? 'bg-hearing-fg' : chat.status === 'error' ? 'bg-stopped-fg' : 'cc-blink bg-waiting-fg',
      )}
    />
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Laptop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {[...items, { to: '/settings', label: 'Settings', icon: Settings }].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-tour={`nav-${label.toLowerCase()}`}
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
          <p className="flex items-center gap-2 font-semibold text-ink">
            {user!.name} {chatDot}
          </p>
          <p className="text-ink-muted">{office?.name}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <Logo />
          <div className="flex min-w-0 items-center gap-2">
            {chatDot}
            <span className="truncate text-label text-ink-muted">{office?.name}</span>
            <Link to="/settings" data-tour="nav-settings" aria-label="Settings" className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised">
              <Settings className="size-5" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-5 lg:px-10 lg:pb-10 lg:pt-8">
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
                data-tour={`nav-${label.toLowerCase()}`}
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
