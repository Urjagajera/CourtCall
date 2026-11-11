import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'

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
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center gap-6 px-4 py-10">
      <Logo size="lg" />
      {before}
      <div className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
        <h1 className="text-h1">{title}</h1>
        {subtitle && <p className="mt-1 text-label text-ink-muted">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
      <p className="text-center text-caption text-ink">
        eCourts tells you which day. CourtCall tells you the latest reported courtroom progress.
      </p>
    </main>
  )
}
