import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/landing/Landing'
import { AppLayout } from './components/AppLayout'
import { TourProvider } from './components/Tour'
import { PageSpinner } from './components/ui'
import type { Role } from './lib/api'
import { AuthProvider, useAuth } from './lib/auth'
import { useTheme } from './lib/theme'
import Verify from './pages/admin/Verify'
import Login from './pages/auth/Login'
import Pending from './pages/auth/Pending'
import Signup from './pages/auth/Signup'
import Room from './pages/court/Room'
import Cases from './pages/lawyer/Cases'
import Clients from './pages/lawyer/Clients'
import Team from './pages/lawyer/Team'
import Today from './pages/lawyer/Today'
import Settings from './pages/Settings'
import Chats from './pages/Chats'

/** Signed-in, verified staff only. Unverified users see the waiting screen. */
function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <PageSpinner />
  // Visitors on "/" see the public landing page; other private URLs go to sign-in.
  if (!user) return pathname === '/' ? <Landing /> : <Navigate to="/login" replace />
  if (user.verificationStatus !== 'verified') return <Pending />
  return <>{children}</>
}

function RoleOnly({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  return roles.includes(user!.role) ? <>{children}</> : <Navigate to="/" replace />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function Home() {
  const { user } = useAuth()
  return user!.role === 'admin' ? <Navigate to="/admin" replace /> : <Today />
}

function ThemeBoot() {
  useTheme() // keeps the system theme listener active app-wide
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeBoot />
      <BrowserRouter>
        <TourProvider>
        <Routes>
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route index element={<Home />} />
            <Route path="room/:id" element={<RoleOnly roles={['lawyer', 'junior']}><Room /></RoleOnly>} />
            <Route path="chats" element={<RoleOnly roles={['lawyer', 'junior', 'staff']}><Chats /></RoleOnly>} />
            <Route path="cases" element={<RoleOnly roles={['lawyer', 'junior', 'staff']}><Cases /></RoleOnly>} />
            <Route path="clients" element={<RoleOnly roles={['lawyer', 'staff']}><Clients /></RoleOnly>} />
            <Route path="team" element={<RoleOnly roles={['lawyer', 'staff']}><Team /></RoleOnly>} />
            <Route path="admin" element={<RoleOnly roles={['admin']}><Verify /></RoleOnly>} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </TourProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
