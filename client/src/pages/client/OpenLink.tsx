import { Loader2, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Banner } from '../../components/ui'
import { api } from '../../lib/api'

/**
 * A random ID. crypto.randomUUID is missing on older Android phones and in some in-app browsers
 * (WhatsApp's own browser), where it threw and left the page stuck on "Opening your case…".
 */
function randomId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  try {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
  }
}

/** A random ID for this phone, kept in the browser. The server stores only a hash of it. */
export function deviceId() {
  const KEY = 'cc-device'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return randomId() // storage blocked: still opens, but only for this visit
  }
}

/** /c/:token — the link the client taps in WhatsApp. Activates it, then moves to /case (token leaves the history). */
export default function OpenLink() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    // A slow network must never leave the page spinning forever.
    const slow = window.setTimeout(() => setError('This is taking too long. Check your internet connection and open the link again.'), 25_000)
    Promise.resolve()
      .then(() => api('/c/activate', { body: { token, deviceId: deviceId() } }))
      .then(() => navigate('/case', { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'This link could not be opened'))
      .finally(() => window.clearTimeout(slow))
  }, [token, navigate])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center gap-6 px-4 py-10">
      <Logo size="lg" />
      {error ? (
        <div className="flex flex-col gap-3">
          <Banner tone="stopped">{error}</Banner>
          <p className="flex items-start gap-2 text-label text-ink-muted">
            <Smartphone className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            Each CourtCall link works on one phone only, to keep your case private. In the first 15 minutes after you open it, you can still move it to another phone or browser. After that, your lawyer can send you a new link anytime.
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-body">
          <Loader2 className="size-5 animate-spin" strokeWidth={1.75} /> Opening your case…
        </p>
      )}
    </main>
  )
}
