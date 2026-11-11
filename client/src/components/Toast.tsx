import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cx, type Tone } from './ui'

const border: Record<Tone, string> = {
  hearing: 'border-l-hearing-fg',
  waiting: 'border-l-waiting-fg',
  stopped: 'border-l-stopped-fg',
  stale: 'border-l-stale-fg',
  info: 'border-l-info-fg',
}

export interface ToastData {
  id: number
  tone: Tone
  message: ReactNode
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

/** One toast at a time, pinned above the phone tab bar. */
export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, toast.durationMs ?? 4000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6">
      <div
        role="status"
        className={cx(
          'flex w-full max-w-[448px] items-center gap-3 rounded-lg border border-line border-l-4 bg-surface px-4 py-3 shadow-sheet',
          border[toast.tone],
        )}
      >
        <div className="min-w-0 flex-1 text-label">{toast.message}</div>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick()
              onDismiss()
            }}
            className="h-10 rounded-md bg-accent px-4 text-label font-semibold text-accent-ink"
          >
            {toast.action.label}
          </button>
        )}
        <button onClick={onDismiss} aria-label="Dismiss" className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
