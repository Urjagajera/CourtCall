import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { TourStep } from '../lib/tourSteps'
import { cx } from './ui'

// Guided tour: dims the page, "zooms" a spotlight onto one feature at a time, and explains it.
// Next / Back move between steps (across pages), End tour stops it at any point.

interface TourApi {
  start: (steps: TourStep[], onDone: () => void) => void
  active: boolean
}
const TourContext = createContext<TourApi>({ start: () => {}, active: false })
export const useTour = () => useContext(TourContext)

const PAD = 8
const WAIT_MS = 4000

/** Visible element for a data-tour key (nav items exist twice: sidebar + phone tab bar). */
function findTarget(key: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

type Box = { top: number; left: number; width: number; height: number }
const fullScreen = (): Box => ({ top: 0, left: 0, width: innerWidth, height: innerHeight })

export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [found, setFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const direction = useRef<1 | -1>(1)
  const onDoneRef = useRef<() => void>(() => {})
  const resolvedRoutes = useRef(new Map<string, string>())
  const navigate = useNavigate()
  const location = useLocation()

  const start = useCallback((s: TourStep[], onDone: () => void) => {
    onDoneRef.current = onDone
    resolvedRoutes.current.clear()
    direction.current = 1
    setBox(fullScreen())
    setIndex(0)
    setSteps(s)
  }, [])

  const end = useCallback(() => {
    setSteps(null)
    setBox(null)
    onDoneRef.current()
  }, [])

  const step = steps?.[index]

  /** The page this step lives on: its own route, or the nearest earlier step's route. */
  const routeFor = useCallback(
    (i: number): string | null => {
      if (!steps) return null
      for (let j = i; j >= 0; j--) {
        const s = steps[j]
        if (!s.route) continue
        const cached = resolvedRoutes.current.get(s.id)
        if (cached) return cached
        const r = typeof s.route === 'function' ? s.route() : s.route
        if (r) resolvedRoutes.current.set(s.id, r)
        return r
      }
      return null
    },
    [steps],
  )

  // Go to the step's page, then wait for its target to appear.
  useEffect(() => {
    if (!step) return
    const route = routeFor(index)
    if (route && route !== location.pathname) {
      navigate(route)
      return // effect re-runs after navigation
    }
    if (!step.target) {
      setFound(false)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const startedAt = Date.now()
    const look = () => {
      if (cancelled) return
      const el = findTarget(step.target!)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
        setFound(true)
        setSearching(false)
        return
      }
      if (Date.now() - startedAt > WAIT_MS) {
        setSearching(false)
        if (step.optional) {
          // Not on screen (e.g. no courtroom today): skip in the direction the user was going.
          setIndex((i) => Math.min(Math.max(i + direction.current, 0), steps!.length - 1))
        } else setFound(false)
        return
      }
      setTimeout(look, 120)
    }
    look()
    return () => {
      cancelled = true
    }
  }, [step, index, location.pathname, navigate, routeFor, steps])

  // Keep the spotlight glued to the target (scrolling, resizing, layout changes).
  useLayoutEffect(() => {
    if (!step) return
    const measure = () => {
      const el = step.target && found ? findTarget(step.target) : null
      let next: Box
      if (el) {
        const r = el.getBoundingClientRect()
        next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
      } else {
        // Centered card: collapse the hole to a point in the middle = whole page dimmed.
        next = { top: innerHeight / 2, left: innerWidth / 2, width: 0, height: 0 }
      }
      // Only re-render when the box actually moved (this loop runs every frame).
      setBox((prev) =>
        prev &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      )
    }
    // Re-measure on scroll/resize, plus a light timer for layout changes (smooth scrolling, zoom,
    // content loading). Timers keep working where animation frames are paused (background tabs).
    measure()
    const timer = setInterval(measure, 60)
    addEventListener('scroll', measure, true)
    addEventListener('resize', measure)
    return () => {
      clearInterval(timer)
      removeEventListener('scroll', measure, true)
      removeEventListener('resize', measure)
    }
  }, [step, found])

  // "Zoom" the highlighted feature slightly while it is in focus.
  useEffect(() => {
    if (!step?.target || !found) return
    const el = findTarget(step.target)
    if (!el || reducedMotion()) return
    const scale = Math.min(1.04, 1 + 18 / Math.max(el.offsetWidth, 1))
    const prev = { transform: el.style.transform, transition: el.style.transition }
    el.style.transition = 'transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)'
    el.style.transform = `scale(${scale})`
    return () => {
      el.style.transform = prev.transform
      el.style.transition = prev.transition
    }
  }, [step, found])

  const next = useCallback(() => {
    if (!steps) return
    direction.current = 1
    setFound(false)
    if (index >= steps.length - 1) end()
    else setIndex(index + 1)
  }, [steps, index, end])

  const back = useCallback(() => {
    direction.current = -1
    setFound(false)
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  useEffect(() => {
    if (!steps) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [steps, next, back, end])

  const api = useMemo(() => ({ start, active: !!steps }), [start, steps])

  return (
    <TourContext.Provider value={api}>
      {children}
      {steps && step && box && (
        <TourOverlay
          step={step}
          index={index}
          total={steps.length}
          box={box}
          hasTarget={!!step.target && found}
          searching={searching}
          onNext={next}
          onBack={back}
          onEnd={end}
        />
      )}
    </TourContext.Provider>
  )
}

function TourOverlay({
  step,
  index,
  total,
  box,
  hasTarget,
  searching,
  onNext,
  onBack,
  onEnd,
}: {
  step: TourStep
  index: number
  total: number
  box: Box
  hasTarget: boolean
  searching: boolean
  onNext: () => void
  onBack: () => void
  onEnd: () => void
}) {
  const nextRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [index])

  const last = index === total - 1
  const motion = reducedMotion() ? 'none' : 'top 450ms cubic-bezier(0.2,0.8,0.2,1), left 450ms cubic-bezier(0.2,0.8,0.2,1), width 450ms cubic-bezier(0.2,0.8,0.2,1), height 450ms cubic-bezier(0.2,0.8,0.2,1)'

  // Card position: under the feature if there is room, otherwise above; phones dock it to the bottom/top edge.
  const vw = innerWidth
  const vh = innerHeight
  const cardW = Math.min(380, vw - 32)
  const phone = vw < 640
  const CARD_H = 250
  const GAP = 12
  let cardStyle: React.CSSProperties | null = null // null = centered
  if (hasTarget && phone) {
    const targetLow = box.top + box.height / 2 > vh / 2
    cardStyle = targetLow ? { top: 16, left: 16, right: 16 } : { bottom: 16, left: 16, right: 16 }
  } else if (hasTarget) {
    // Prefer below, then above, then beside the feature, so the card never covers it.
    const spaceBelow = vh - (box.top + box.height)
    const spaceAbove = box.top
    const spaceRight = vw - (box.left + box.width)
    const spaceLeft = box.left
    const centeredLeft = Math.min(Math.max(16, box.left + box.width / 2 - cardW / 2), vw - cardW - 16)
    const sideTop = Math.min(Math.max(16, box.top + box.height / 2 - CARD_H / 2), vh - CARD_H - 16)
    if (spaceBelow >= CARD_H + GAP) cardStyle = { top: box.top + box.height + GAP, left: centeredLeft, width: cardW }
    else if (spaceAbove >= CARD_H + GAP) cardStyle = { top: box.top - GAP - CARD_H, left: centeredLeft, width: cardW }
    else if (spaceRight >= cardW + GAP + 16) cardStyle = { top: sideTop, left: box.left + box.width + GAP, width: cardW }
    else if (spaceLeft >= cardW + GAP + 16) cardStyle = { top: sideTop, left: box.left - GAP - cardW, width: cardW }
    else cardStyle = { bottom: 16, left: centeredLeft, width: cardW }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Blocks clicks on the page while the tour runs. */}
      <div className="absolute inset-0" />
      {/* Spotlight: the hole is the highlighted feature, the huge shadow dims everything else. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-lg"
        style={{
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          boxShadow: '0 0 0 9999px rgb(42 34 32 / 0.66)',
          outline: hasTarget ? '2px solid var(--detail)' : 'none',
          outlineOffset: 2,
          transition: motion,
        }}
      />
      {/* Centered cards use a flex wrapper (the pop-in animation owns `transform`). */}
      <div className={cardStyle ? 'contents' : 'pointer-events-none absolute inset-0 flex items-center justify-center p-4'}>
      <div
        key={step.id}
        className={cx('cc-pop rounded-lg border border-line bg-surface p-4 text-ink shadow-sheet', cardStyle ? 'absolute' : 'pointer-events-auto relative')}
        style={cardStyle ?? { width: cardW }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
            Step {index + 1} of {total}
          </span>
          <button onClick={onEnd} className="flex items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold text-ink-muted hover:bg-surface-raised hover:text-ink">
            <X className="size-3.5" strokeWidth={2} /> End tour
          </button>
        </div>
        <h2 id="tour-title" className="mt-2 text-h2">
          {step.title}
        </h2>
        <p className="mt-1 text-label text-ink-muted" aria-live="polite">
          {searching ? 'Opening…' : step.body}
        </p>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= index ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            disabled={index === 0}
            className="flex h-10 items-center gap-1 rounded-md px-3 text-label font-semibold hover:bg-surface-raised disabled:invisible"
          >
            <ArrowLeft className="size-4" strokeWidth={2} /> Back
          </button>
          <button
            ref={nextRef}
            onClick={onNext}
            className="flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-label font-semibold text-accent-ink hover:bg-accent-strong"
          >
            {last ? (
              <>
                Finish <Check className="size-4" strokeWidth={2} />
              </>
            ) : index === 0 ? (
              <>
                Start tour <ArrowRight className="size-4" strokeWidth={2} />
              </>
            ) : (
              <>
                Next <ArrowRight className="size-4" strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
