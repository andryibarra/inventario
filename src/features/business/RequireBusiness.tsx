import { Navigate, Outlet } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { FullPageSpinner } from '../../components/ui/FullPageSpinner'
import { toUserMessage } from '../../lib/errors'
import { useBusinesses } from './BusinessContext'

export function RequireBusiness() {
  const { isLoading, error, active } = useBusinesses()

  if (isLoading) return <FullPageSpinner />
  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <Alert tone="error">{toUserMessage(error)}</Alert>
      </main>
    )
  }
  if (!active) return <Navigate to="/crear-negocio" replace />
  return <Outlet />
}
