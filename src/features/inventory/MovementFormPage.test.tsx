import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryResult, renderInBusiness } from '../../test/renderInBusiness'
import { MovementFormPage } from './MovementFormPage'

const rpc = vi.fn()
const from = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}))

const ARROZ = {
  id: 'producto-1',
  business_id: 'negocio-1',
  name: 'Arroz',
  unit: 'kg',
  quantity: 10,
  average_cost: 3000,
  sale_price: 4200,
  is_active: true,
  is_low_stock: false,
}

const TRIAL = {
  status: 'trialing',
  trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
  current_period_end: null,
  grace_days: 7,
}

function renderForm(tipo: string) {
  renderInBusiness(<MovementFormPage />, {
    path: '/inventario/registrar',
    url: `/inventario/registrar?tipo=${tipo}&producto=producto-1`,
    extraRoutes: ['/productos/:productId'],
  })
}

describe('MovementFormPage', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    from.mockImplementation((table: string) =>
      queryResult(table === 'product_overview' ? ARROZ : TRIAL),
    )
  })

  it('registra una entrada con cantidad y costo, sugiriendo el costo promedio', async () => {
    rpc.mockResolvedValue({ data: 'mov-1', error: null })
    renderForm('entrada')

    const cost = await screen.findByLabelText('Costo por unidad')
    expect(cost).toHaveValue('3000')
    await userEvent.type(screen.getByLabelText('Cantidad que entra (kg)'), '2,5')
    await userEvent.clear(cost)
    await userEvent.type(cost, '3.200')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))

    expect(await screen.findByText('Destino /productos/:productId')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('record_stock_movement', {
      p_business_id: 'negocio-1',
      p_product_id: 'producto-1',
      p_type: 'purchase',
      p_quantity: 2.5,
      p_unit_cost: 3200,
      p_idempotency_key: expect.any(String),
    })
  })

  it('una salida exige motivo y lo envía junto con el detalle', async () => {
    rpc.mockResolvedValue({ data: 'mov-2', error: null })
    renderForm('salida')

    await userEvent.type(await screen.findByLabelText('Cantidad que sale (kg)'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar salida' }))
    expect(await screen.findByText('Elige el motivo de la salida.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'Dañado o vencido')
    await userEvent.type(screen.getByLabelText('Detalle (opcional)'), 'bolsa rota')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar salida' }))

    expect(await screen.findByText('Destino /productos/:productId')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith(
      'record_stock_movement',
      expect.objectContaining({
        p_type: 'output',
        p_quantity: 1,
        p_reason: 'Dañado o vencido: bolsa rota',
      }),
    )
  })

  it('muestra un mensaje claro si no hay stock suficiente', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'insufficient_stock' } })
    renderForm('salida')

    await userEvent.type(await screen.findByLabelText('Cantidad que sale (kg)'), '50')
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'Otro')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar salida' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay suficientes unidades disponibles para esa salida.',
    )
  })

  it('el ajuste muestra la diferencia antes de guardar y envía la cantidad contada', async () => {
    rpc.mockResolvedValue({ data: 'mov-3', error: null })
    renderForm('ajuste')

    await userEvent.type(await screen.findByLabelText('¿Cuántos contaste? (kg)'), '7,5')
    expect(screen.getByText('−2,5')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))

    expect(await screen.findByText('Destino /productos/:productId')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('adjust_stock', {
      p_business_id: 'negocio-1',
      p_product_id: 'producto-1',
      p_counted_quantity: 7.5,
      p_reason: 'Conteo físico',
      p_idempotency_key: expect.any(String),
    })
  })
})
