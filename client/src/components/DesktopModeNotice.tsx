import { MonitorSmartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isStandalone } from '../lib/install'

const KEY = 'cc-desktop-notice-dismissed'

/**
 * A phone in Chrome's "Desktop site" mode lays the page out ~980px wide and shrinks it, so
 * everything looks tiny. The page can't override that, so we detect it and explain the fix.
 * Detection: a touch screen whose layout is much wider than the physical screen.
 */
function phoneInDesktopMode() {
  return navigator.maxTouchPoints > 0 && screen.width <= 600 && innerWidth > screen.width * 1.4
}

export function DesktopModeNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try {
      dismissed = sessionStorage.getItem(KEY) === '1'
    } catch {
      /* storage blocked: still show */
    }
    const check = () => setShow(!dismissed && phoneInDesktopMode())
    check()
    addEventListener('resize', check)
    return () => removeEventListener('resize', check)
  }, [])
  if (!show) return null

  return (
    <div role="alert" className="sticky top-0 z-[70] border-b-2 border-accent bg-surface px-4 py-3 text-ink shadow-sheet">
      <div className="mx-auto flex max-w-[900px] items-start gap-3">
        <MonitorSmartphone className="mt-1 size-7 shrink-0 text-accent" strokeWidth={1.75} />
        <div className="min-w-0 flex-1 text-[1.6rem] leading-snug">
          <p className="font-bold">Everything looks small because your phone is showing the desktop site.</p>
          <p className="mt-1">
            {isStandalone()
              ? 'Open Chrome, tap ⋮ → Settings → Site settings → Desktop site, turn it off, then reopen CourtCall.'
              : 'In Chrome, tap ⋮ (top right) and untick "Desktop site".'}
          </p>
        </div>
        <button
          onClick={() => {
            try {
              sessionStorage.setItem(KEY, '1')
            } catch {
              /* ignore */
            }
            setShow(false)
          }}
          aria-label="Dismiss"
          className="flex size-12 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised"
        >
          <X className="size-7" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
