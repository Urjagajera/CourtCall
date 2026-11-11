import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-lg border border-line bg-surface p-5 shadow-sheet sm:max-w-lg sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-h2">{title}</h2>
          <button onClick={onClose} className="flex size-10 items-center justify-center rounded-md hover:bg-surface-raised" aria-label="Close">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
