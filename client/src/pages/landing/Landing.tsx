import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  EyeOff,
  GitCompareArrows,
  History,
  Link2,
  Lock,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { cx } from '../../components/ui'
import { prefersReducedMotion, useReveal } from '../../lib/useReveal'
import { FirmNetwork } from './FirmNetwork'
import { HeroScreens, type HeroStatus } from './HeroScreens'
import { DisplayBoard } from './DisplayBoard'
import { LiveDemo } from './LiveDemo'

export default function Landing() {
  useReveal()

  // Hero simulation: Court 4 advances through the cause list by itself.
  // When the visitor taps a junior button, auto-play pauses and resumes after 12s of no taps.
  const [item, setItem] = useState(10)
  const [status, setStatus] = useState<HeroStatus>('hearing')
  const [controlled, setControlled] = useState(false)
  const idle = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (controlled || prefersReducedMotion()) return
    const t = setInterval(() => {
      setStatus('hearing')
      setItem((i) => (i >= 17 ? 10 : i + 1))
    }, 3200)
    return () => clearInterval(t)
  }, [controlled])
  useEffect(() => {
    if (controlled || item !== 13) return
    const t = setTimeout(() => setStatus('break'), 1600)
    return () => clearTimeout(t)
  }, [item, controlled])
  useEffect(() => () => clearTimeout(idle.current), [])
  const takeControl = () => {
    setControlled(true)
    clearTimeout(idle.current)
    idle.current = window.setTimeout(() => setControlled(false), 12000)
  }
  const hero = {
    onNext: () => {
      takeControl()
      setStatus('hearing')
      setItem((i) => (i >= 20 ? 10 : i + 1))
    },
    onPassed: () => {
      takeControl()
      setStatus('passed')
    },
    onBreak: () => {
      takeControl()
      setStatus((s) => (s === 'break' ? 'hearing' : 'break'))
    },
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-label font-medium md:flex">
            <a href="#how" className="hover:underline underline-offset-4">How it works</a>
            <a href="#demo" className="hover:underline underline-offset-4">Live demo</a>
            <a href="#roles" className="hover:underline underline-offset-4">Who it's for</a>
            <a href="#trust" className="hover:underline underline-offset-4">Reliability</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="flex h-10 items-center rounded-md px-3 text-label font-semibold hover:bg-surface/60">
              Sign in
            </Link>
            <Link to="/signup" className="flex h-10 items-center rounded-md bg-accent px-4 text-label font-semibold text-accent-ink hover:bg-accent-strong">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 pb-16 pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:pt-16 xl:gap-16">
        <div className="cc-pop">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-semibold">
            <span className="cc-blink size-2 rounded-full bg-hearing-fg" /> Real-time courtroom communication
          </span>
          <h1 className="mt-4 text-[2.25rem] font-bold leading-[1.15] tracking-tight sm:text-[3rem]">
            Know how far the court has reached. <span className="underline decoration-accent decoration-[6px] underline-offset-[6px]">Without the calls.</span>
          </h1>
          <p className="mt-4 max-w-xl text-body sm:text-[1.125rem] sm:leading-7">
            Juniors tap. Clients get alerted about <b>their</b> case. No app needed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="flex h-12 items-center gap-2 rounded-md bg-accent px-5 text-body font-semibold text-accent-ink shadow-card hover:bg-accent-strong"
            >
              Start your office <ArrowRight className="size-5" strokeWidth={1.75} />
            </Link>
            <Link to="/login" className="flex h-12 items-center gap-2 rounded-md border border-line bg-surface px-5 text-body font-semibold hover:bg-surface-raised">
              Try a demo account
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-label">
            {['No app for clients', 'Works on any phone', 'Private per office'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4" strokeWidth={1.75} /> {t}
              </li>
            ))}
          </ul>
        </div>

        <HeroScreens item={item} status={status} controlled={controlled} {...hero} />
      </section>

      {/* Quote strip */}
      <section className="border-y border-line bg-surface">
        <p className="mx-auto max-w-[1440px] px-4 py-6 text-center text-h2 lg:px-8">
          “eCourts tells you <span className="font-bold">which day</span>. CourtCall tells you the{' '}
          <span className="font-bold">latest reported courtroom progress</span>.”
        </p>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-[1440px] px-4 py-16 lg:px-8">
        <SectionTitle eyebrow="The problem" title="Court days run on phone calls and guesswork" />
        <div className="grid gap-4 md:grid-cols-3">
          <ProblemCard icon={PhoneCall} title="Endless “has my case come up?” calls">
            While the lawyer is busy in another courtroom.
          </ProblemCard>
          <ProblemCard icon={Clock} title="Hours lost waiting outside court">
            Nobody can see how far the list has moved.
          </ProblemCard>
          <ProblemCard icon={MessageCircle} title="Updates scattered across WhatsApp">
            Passed over or recalled? The news arrives late.
          </ProblemCard>
        </div>
      </section>

      {/* How it works + board */}
      <section id="how" className="bg-surface/50 py-16">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionTitle eyebrow="How it works" title="One shared courtroom. Private everything else." align="left" />
            <ol className="flex flex-col gap-4">
              <Step n={1} icon={Smartphone} title="Juniors report with one tap">
                Big buttons, one hand, ten-second undo.
              </Step>
              <Step n={2} icon={Users} title="Rooms are shared across offices">
                Every firm in Court 4 sees the same progress.
              </Step>
              <Step n={3} icon={GitCompareArrows} title="Every update is checked">
                A late update never overwrites newer progress.
              </Step>
              <Step n={4} icon={BellRing} title="Each client hears about their own case">
                Only the clients it concerns are alerted.
              </Step>
            </ol>
          </div>
          <div data-reveal>
            <DisplayBoard />
            <p className="mt-3 text-center text-caption text-ink">Simulated court-complex board, updating like a real day.</p>
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section id="demo" className="mx-auto max-w-[1440px] px-4 py-16 lg:px-8">
        <SectionTitle
          eyebrow="Live demo"
          title="Tap as the junior. Watch the client's phone."
          subtitle="Try the delayed update to see conflict protection."
        />
        <div data-reveal>
          <LiveDemo />
        </div>
      </section>

      {/* Firm network */}
      <section id="roles" className="bg-surface/50 py-16">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
          <SectionTitle eyebrow="Who it's for" title="Your whole firm, connected" subtitle="Tap a person to see who they work with." />
          <div data-reveal>
            <FirmNetwork />
          </div>
        </div>
      </section>
      {/* Trust */}
      <section id="trust" className="mx-auto max-w-[1440px] px-4 py-16 lg:px-8">
        <SectionTitle eyebrow="Reliability & privacy" title="Honest about what it knows" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TrustCard icon={History} title="Full update history">Every report and undo is kept.</TrustCard>
          <TrustCard icon={Clock} title="Stale progress is flagged">No report for 20 minutes? Clearly marked.</TrustCard>
          <TrustCard icon={ShieldCheck} title="Verified reporters only">Bar Council checked. Juniors approved by the firm.</TrustCard>
          <TrustCard icon={EyeOff} title="Office data stays private">Other firms only share courtroom progress.</TrustCard>
          <TrustCard icon={Link2} title="Device-bound client links">Locked to one device. Revoke anytime.</TrustCard>
          <TrustCard icon={Lock} title="No time predictions">Latest reported progress, clearly labelled.</TrustCard>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 lg:px-8">
        <div data-reveal className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-12 text-center shadow-card">
          <h2 className="text-[1.75rem] font-bold leading-tight sm:text-[2.25rem]">Give your clients their time back.</h2>
          <p className="max-w-xl text-body text-ink-muted">Two minutes to set up your firm.</p>
          <Link to="/signup" className="flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-body font-semibold text-accent-ink hover:bg-accent-strong">
            Create your office <ArrowRight className="size-5" strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-8 text-label lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Logo />
          <p className="max-w-2xl text-caption text-ink-muted">
            CourtCall shows the latest courtroom progress reported by verified lawyers and juniors. It does not predict hearing
            times and is not affiliated with eCourts or any official court system.
          </p>
        </div>
      </footer>
    </div>
  )
}

function SectionTitle({ eyebrow, title, subtitle, align = 'center' }: { eyebrow: string; title: string; subtitle?: string; align?: 'center' | 'left' }) {
  return (
    <div data-reveal className={cx('mb-8', align === 'center' && 'mx-auto max-w-2xl text-center')}>
      <p className="text-label font-bold uppercase tracking-[0.18em] text-ink">
        <span className="mr-2 inline-block h-1 w-6 rounded-full bg-accent align-middle" />
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[1.75rem] font-bold leading-tight sm:text-[2.25rem]">{title}</h2>
      {subtitle && <p className="mt-2 text-body text-ink">{subtitle}</p>}
    </div>
  )
}

function ProblemCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div data-reveal className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <span className="flex size-11 items-center justify-center rounded-md bg-stopped-bg text-stopped-fg">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-h2">{title}</p>
      <p className="mt-1 text-label text-ink-muted">{children}</p>
    </div>
  )
}

function Step({ n, icon: Icon, title, children }: { n: number; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <li data-reveal className="flex gap-4 rounded-lg border border-line bg-surface p-4" style={{ transitionDelay: `${n * 60}ms` }}>
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-md bg-base text-ink">
        <Icon className="size-5" strokeWidth={1.75} />
        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-caption font-bold text-accent-ink">
          {n}
        </span>
      </span>
      <div>
        <p className="text-body font-semibold">{title}</p>
        <p className="text-label text-ink-muted">{children}</p>
      </div>
    </li>
  )
}


function TrustCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div data-reveal className="flex gap-3 rounded-lg border border-line bg-surface p-4">
      <Icon className="mt-0.5 size-6 shrink-0" strokeWidth={1.75} />
      <div>
        <p className="text-body font-semibold">{title}</p>
        <p className="text-label text-ink-muted">{children}</p>
      </div>
    </div>
  )
}
