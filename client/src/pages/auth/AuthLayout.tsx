import { ArrowLeft, BellRing, CheckCircle2, Landmark, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'

/**
 * Sign-in / sign-up shell. Phone: one centered column.
 * Laptop: espresso brand panel on the left, forms on the right (no empty side margins).
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  before,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  /** Optional panel shown above the main card (e.g. demo logins). */
  before?: ReactNode
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <BrandPanel />
      <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center gap-6 px-4 py-10 lg:max-w-[560px] lg:px-8">
        <Link
          to="/"
          className="flex w-fit items-center gap-1.5 rounded-md text-label font-semibold text-ink-muted hover:text-ink hover:underline underline-offset-4"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} /> Back to home
        </Link>
        <Link to="/" aria-label="CourtCall home" className="w-fit lg:hidden">
          <Logo size="lg" />
        </Link>
        {before}
        <div className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
          <h1 className="text-h1">{title}</h1>
          {subtitle && <p className="mt-1 text-label text-ink-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="text-center text-caption text-ink lg:hidden">
          eCourts tells you which day. CourtCall tells you the latest reported courtroom progress.
        </p>
      </main>
    </div>
  )
}

function BrandPanel() {
  const points = [
    { icon: Users, text: 'Juniors report courtroom progress in one tap' },
    { icon: Landmark, text: 'Shared courtroom rooms across law offices' },
    { icon: BellRing, text: 'Each client is alerted about their own case' },
    { icon: ShieldCheck, text: 'Verified lawyers, private office data' },
  ]
  return (
    <aside className="sticky top-0 hidden h-screen flex-col justify-between bg-[#463B36] p-10 text-[#F4EEEA] lg:flex xl:p-14">
      <Link to="/" className="flex items-center gap-2" aria-label="CourtCall home">
        <span className="flex size-11 items-center justify-center rounded-md bg-[#7B3B36] text-white">
          <Landmark className="size-6" strokeWidth={1.75} />
        </span>
        <span className="text-h1">CourtCall</span>
      </Link>

      <div className="max-w-md">
        <p className="text-[2rem] font-bold leading-tight">Courtroom progress, for everyone who needs to know.</p>
        <ul className="mt-8 flex flex-col gap-4">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-body">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#B4907C]/50 text-[#B4907C]">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <figure className="border-l-2 border-[#B4907C] pl-4">
        <blockquote className="text-body italic text-[#E8DDD6]">
          “eCourts tells you which day. CourtCall tells you the latest reported courtroom progress.”
        </blockquote>
        <figcaption className="mt-2 flex items-center gap-1.5 text-caption text-[#CDBFB5]">
          <CheckCircle2 className="size-3.5" strokeWidth={1.75} /> No app needed for clients
        </figcaption>
      </figure>
    </aside>
  )
}
