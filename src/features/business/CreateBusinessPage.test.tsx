import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import { BusinessContext, type BusinessContextValue } from './BusinessContext'
import { CreateBusinessPage } from './CreateBusinessPage'

const rpc = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}))

const auth = {
  status: 'signedIn',
  user: { id: 'user-1', email: 'ana@tienda.co' },
  session: {},
  isRecovery: false,
  signOut: vi.fn(),
} as unknown as AuthContextValue

function renderPage(setActiveId = vi.fn()) {
  const business: BusinessContextValue = {
    memberships: [],
    isLoading: false,
    error: null,
    active: null,
    setActiveId,
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext value={auth}>
        <BusinessContext value={business}>
          <MemoryRouter initialEntries={['/crear-negocio']}>
            <Routes>
              <Route path="/crear-negocio" element={<CreateBusinessPage />} />
              <Route path="/" element={<p>Inicio</p>} />
            </Routes>
          </MemoryRouter>
        </BusinessContext>
      </AuthContext>
    </QueryClientProvider>,
  )
  return { setActiveId }
}

describe('CreateBusinessPage', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('exige el nombre del negocio', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Crear negocio' }))
    expect(await screen.findByText('Escribe el nombre de tu negocio.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('crea el negocio por RPC, lo activa y lleva al inicio', async () => {
    rpc.mockResolvedValue({ data: 'negocio-nuevo', error: null })
    const { setActiveId } = renderPage()

    await userEvent.type(screen.getByLabelText('Nombre del negocio'), '  Tienda Doña Rosa ')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de negocio (opcional)'), 'minimercado')
    await userEvent.click(screen.getByRole('button', { name: 'Crear negocio' }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('create_business', {
      p_name: 'Tienda Doña Rosa',
      p_business_type: 'minimercado',
    })
    expect(setActiveId).toHaveBeenCalledWith('negocio-nuevo')
  })

  it('muestra un mensaje entendible si el servidor rechaza la creación', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'business_limit_reached' } })
    renderPage()

    await userEvent.type(screen.getByLabelText('Nombre del negocio'), 'Otra tienda')
    await userEvent.click(screen.getByRole('button', { name: 'Crear negocio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcanzaste el máximo de negocios por cuenta.',
    )
  })
})
