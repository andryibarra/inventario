import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '../../components/ui/FullPageSpinner'
import { BusinessProvider } from '../business/BusinessProvider'
import { useAuth } from './AuthContext'
import { safeRedirectPath } from './redirect'

type LocationState = { from?: unknown } | null

export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageSpinner />
  if (auth.status === 'signedOut') {
    return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
  }
  return (
    <BusinessProvider key={auth.user.id} userId={auth.user.id}>
      <Outlet />
    </BusinessProvider>
  )
}

/** Pantallas de ingreso/registro: si ya hay sesión, vuelve a la app. */
export function PublicOnly() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageSpinner />
  if (auth.status === 'signedIn') {
    const from = (location.state as LocationState)?.from
    return <Navigate to={safeRedirectPath(from)} replace />
  }
  return <Outlet />
}
