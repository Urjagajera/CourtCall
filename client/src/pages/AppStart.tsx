import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * Where the installed app opens (manifest start_url). Sends each person to the right place:
 * staff to their dashboard, a client (link already opened on this phone) to their case, others to sign in.
 */
export default function AppStart() {
  const navigate = useNavigate()
  useEffect(() => {
    ;(async () => {
      const me = await api<{ user: unknown }>('/auth/me').catch(() => ({ user: null }))
      if (me.user) return navigate('/', { replace: true })
      const client = await api('/c/me').then(
        () => true,
        () => false,
      )
      navigate(client ? '/case' : '/login', { replace: true })
    })()
  }, [navigate])
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-ink-muted" strokeWidth={1.75} aria-label="Opening CourtCall" />
    </main>
  )
}
