import { Loader2, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Banner } from '../../components/ui'
import { api } from '../../lib/api'

/** A random ID for this phone, kept in the browser. The server stores only a hash of it. */
export function deviceId() {
  const KEY = 'cc-device'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID() // storage blocked: still opens, but only for this visit
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
    api('/c/activate', { body: { token, deviceId: deviceId() } })
      .then(() => navigate('/case', { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'This link could not be opened'))
  }, [token, navigate])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center gap-6 px-4 py-10">
      <Logo size="lg" />
      {error ? (
        <div className="flex flex-col gap-3">
          <Banner tone="stopped">{error}</Banner>
          <p className="flex items-start gap-2 text-label text-ink-muted">
            <Smartphone className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            Each CourtCall link works on one phone only, to keep your case private. Your lawyer can send you a new link anytime.
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
