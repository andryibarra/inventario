import { createContext, useContext } from 'react'
import type { Membership } from './api'

export type BusinessContextValue = {
  memberships: Membership[]
  isLoading: boolean
  error: unknown
  /** Negocio con el que se está trabajando; null si el usuario no tiene ninguno. */
  active: Membership | null
  setActiveId: (businessId: string) => void
}

export const BusinessContext = createContext<BusinessContextValue | null>(null)

export function useBusinesses(): BusinessContextValue {
  const value = useContext(BusinessContext)
  if (!value) throw new Error('useBusinesses debe usarse dentro de <BusinessProvider>')
  return value
}

/** Para pantallas protegidas por <RequireBusiness>, donde siempre hay negocio activo. */
export function useActiveBusiness(): Membership {
  const { active } = useBusinesses()
  if (!active) throw new Error('useActiveBusiness requiere un negocio activo')
  return active
}
