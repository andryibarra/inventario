import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { readLocal, writeLocal } from '../../lib/storage'
import { businessKeys, fetchMemberships } from './api'
import { BusinessContext } from './BusinessContext'

export function BusinessProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const storageKey = `inventario.negocioActivo.${userId}`
  const [preferredId, setPreferredId] = useState(() => readLocal(storageKey))

  const query = useQuery({
    queryKey: businessKeys.memberships(userId),
    queryFn: () => fetchMemberships(userId),
  })

  const memberships = useMemo(() => query.data ?? [], [query.data])
  // Si el negocio recordado ya no es accesible, se usa el primero disponible.
  const active = memberships.find((m) => m.id === preferredId) ?? memberships[0] ?? null

  const setActiveId = useCallback(
    (businessId: string) => {
      setPreferredId(businessId)
      writeLocal(storageKey, businessId)
    },
    [storageKey],
  )

  const value = useMemo(
    () => ({
      memberships,
      isLoading: query.isPending,
      error: query.error,
      active,
      setActiveId,
    }),
    [memberships, query.isPending, query.error, active, setActiveId],
  )

  return <BusinessContext value={value}>{children}</BusinessContext>
}
