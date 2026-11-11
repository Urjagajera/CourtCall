import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type Office, type User } from './api'

interface AuthState {
  user: User | null
  office: Office | null
  loading: boolean
  refresh: () => Promise<void>
  setSession: (user: User) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [office, setOffice] = useState<Office | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User; office: Office | null }>('/auth/me')
      setUser(me.user)
      setOffice(me.office)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) console.error(e)
      setUser(null)
      setOffice(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setSession = useCallback(async () => {
    await refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
    setOffice(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, office, loading, refresh, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
