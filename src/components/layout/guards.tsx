import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@/domain/types'
import { useSession } from '@/store/useStore'

export const homeFor = (role: Role) => (role === 'staff' || role === 'manager' ? (role === 'manager' ? '/manage/dashboard' : '/manage') : '/app/home')

/** Requires a signed-in demo session with one of the given roles; otherwise sends to the right entry point. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/app/sign-in" state={{ from: location.pathname }} replace />
  if (!roles.includes(session.role)) return <Navigate to={homeFor(session.role)} replace />
  if (!session.onboarded && !location.pathname.startsWith('/app/onboarding')) return <Navigate to="/app/onboarding" replace />
  return <Outlet />
}

/** /app: fresh visitors land on the welcome screen; returning sessions go home. */
export function AppEntry() {
  const session = useSession()
  if (!session) return <Navigate to="/app/welcome" replace />
  return <Navigate to={homeFor(session.role)} replace />
}
