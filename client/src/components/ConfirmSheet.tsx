import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from './Sheet'
import { Banner, Button } from './ui'

/** Styled replacement for window.confirm(), used for destructive actions. */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Sheet
      open={open}
      title={title}
      onClose={() => {
        setError(null)
        onClose()
      }}
    >
      <p className="text-body">{message}</p>
      {error && (
        <div className="mt-3">
          <Banner tone="stopped">{error}</Banner>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={busy}
          icon={<Trash2 className="size-5" strokeWidth={1.75} />}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await onConfirm()
              onClose()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not complete this action')
            } finally {
              setBusy(false)
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
