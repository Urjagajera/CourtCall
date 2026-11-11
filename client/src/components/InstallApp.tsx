import { Download, Share, Smartphone } from 'lucide-react'
import { useInstall } from '../lib/install'
import { Button, Card } from './ui'

/** "Install CourtCall on this phone" card. Hidden once the app is installed. */
export function InstallApp({ compact }: { compact?: boolean }) {
  const { mode, install } = useInstall()
  if (mode === 'installed') return null

  if (compact) {
    return mode === 'prompt' ? (
      <button
        onClick={install}
        className="flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-label font-semibold hover:bg-surface-raised"
      >
        <Download className="size-4" strokeWidth={1.75} /> Install app
      </button>
    ) : null
  }

  return (
    <Card className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-base">
        <Smartphone className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label font-semibold">Install CourtCall on this phone</p>
        <p className="text-caption text-ink-muted">
          {mode === 'prompt'
            ? 'Opens like an app from your home screen, full screen, with alerts.'
            : mode === 'ios'
              ? 'In Safari, tap Share, then "Add to Home Screen". Needed on iPhone for alerts.'
              : 'In Chrome, open the ⋮ menu and tap "Install app" or "Add to Home screen".'}
        </p>
      </div>
      {mode === 'prompt' ? (
        <Button size="sm" onClick={install} icon={<Download className="size-4" strokeWidth={1.75} />}>
          Install
        </Button>
      ) : mode === 'ios' ? (
        <Share className="mt-1 size-5 shrink-0 text-ink-muted" strokeWidth={1.75} />
      ) : null}
    </Card>
  )
}
