import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../features/auth/AuthContext'
import type { Membership } from '../features/business/api'
import { BusinessContext, type BusinessContextValue } from '../features/business/BusinessContext'

export const TEST_BUSINESS: Membership = {
  id: 'negocio-1',
  name: 'Tienda Doña Rosa',
  business_type: null,
  currency: 'COP',
  timezone: 'America/Bogota',
  status: 'active',
  role: 'owner',
}

const auth = {
  status: 'signedIn',
  user: { id: 'user-1', email: 'ana@tienda.co' },
  session: {},
  isRecovery: false,
  signOut: vi.fn(),
} as unknown as AuthContextValue

/**
 * Respuesta encadenable que imita el query builder de supabase-js:
 * cualquier método (.select, .eq, .order…) devuelve el mismo objeto y al
 * esperarlo entrega { data, error }.
 */
export function queryResult(data: unknown) {
  const result = { data, error: null }
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  const proxy: unknown = new Proxy(builder, {
    get: (target, prop: string) => (prop in target ? target[prop] : () => proxy),
  })
  return proxy
}

/** Renderiza `element` en `path`, dentro de un negocio activo, con rutas de destino de prueba. */
export function renderInBusiness(
  element: ReactNode,
  { path, url, extraRoutes = [] }: { path: string; url: string; extraRoutes?: string[] },
) {
  const business: BusinessContextValue = {
    memberships: [TEST_BUSINESS],
    isLoading: false,
    error: null,
    active: TEST_BUSINESS,
    setActiveId: vi.fn(),
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <BusinessContext value={business}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path={path} element={element} />
              {extraRoutes.map((route) => (
                <Route key={route} path={route} element={<p>Destino {route}</p>} />
              ))}
            </Routes>
          </MemoryRouter>
        </BusinessContext>
      </AuthContext>
    </QueryClientProvider>,
  )
}
