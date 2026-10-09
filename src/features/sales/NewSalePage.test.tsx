import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryResult, renderInBusiness } from '../../test/renderInBusiness'
import { NewSalePage } from './NewSalePage'

const rpc = vi.fn()
const from = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}))

const TRIAL = {
  status: 'trialing',
  trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
  current_period_end: null,
  grace_days: 7,
}

const PRODUCTS = [
  {
    id: 'p-arroz',
    name: 'Arroz',
    unit: 'unidad',
    quantity: 5,
    sale_price: 2800,
    barcode: '7701',
    sku: null,
  },
  {
    id: 'p-queso',
    name: 'Queso',
    unit: 'kg',
    quantity: 2.5,
    sale_price: 18000,
    barcode: null,
    sku: 'QUE',
  },
]

function renderPage() {
  renderInBusiness(<NewSalePage />, {
    path: '/ventas/nueva',
    url: '/ventas/nueva',
    extraRoutes: ['/ventas/:saleId'],
  })
}

async function addProduct(name: string) {
  const results = await screen.findByRole('list', { name: 'Resultados' })
  await userEvent.click(within(results).getByRole('button', { name: new RegExp(name) }))
}

describe('NewSalePage', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    from.mockImplementation((table: string) =>
      queryResult(table === 'product_overview' ? PRODUCTS : TRIAL),
    )
  })

  it('arma la venta, muestra el total y la registra con precios y cantidades', async () => {
    rpc.mockResolvedValue({ data: 'venta-1', error: null })
    renderPage()

    await addProduct('Arroz')
    await addProduct('Arroz')
    await addProduct('Queso')
    const quesoQty = screen.getByLabelText('Cantidad (kg)')
    await userEvent.clear(quesoQty)
    await userEvent.type(quesoQty, '0,5')
    await userEvent.selectOptions(screen.getByLabelText('Medio de pago'), 'transfer')
    await userEvent.type(screen.getByLabelText('Descuento (opcional)'), '600')

    // 2 × 2800 + 0,5 × 18000 − 600 = 14.000
    expect(screen.getByText('Total').nextSibling).toHaveTextContent('$ 14.000')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(await screen.findByText('Destino /ventas/:saleId')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('create_sale', {
      p_business_id: 'negocio-1',
      p_items: [
        { product_id: 'p-arroz', quantity: 2, unit_price: 2800 },
        { product_id: 'p-queso', quantity: 0.5, unit_price: 18000 },
      ],
      p_idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_payment_method: 'transfer',
      p_discount: 600,
    })
  })

  it('no envía la venta si se pide más de lo disponible', async () => {
    renderPage()
    await addProduct('Arroz')
    const qty = screen.getByLabelText('Cantidad (und.)')
    await userEvent.clear(qty)
    await userEvent.type(qty, '9')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(await screen.findByText('Solo hay 5 disponibles.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('agrega el producto al escanear su código de barras', async () => {
    renderPage()
    await screen.findByRole('list', { name: 'Resultados' })
    await userEvent.type(screen.getByLabelText('Agregar producto'), '7701{Enter}')

    expect(await screen.findByLabelText('Cantidad (und.)')).toHaveValue('1')
    expect(screen.getByLabelText('Agregar producto')).toHaveValue('')
  })

  it('si otra persona vendió primero, dice qué producto no alcanza', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'insufficient_stock',
        details: '{"product": "Arroz", "available": 1}',
      },
    })
    renderPage()
    await addProduct('Arroz')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No alcanza «Arroz»: quedan 1.')
  })
})
