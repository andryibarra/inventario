import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryResult, renderInBusiness } from '../../test/renderInBusiness'
import { ProductFormPage } from './ProductFormPage'

const rpc = vi.fn()
const from = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}))

function renderNew() {
  renderInBusiness(<ProductFormPage />, {
    path: '/productos/nuevo',
    url: '/productos/nuevo',
    extraRoutes: ['/productos/:productId'],
  })
}

describe('ProductFormPage (nuevo)', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    from.mockReturnValue(queryResult([{ id: 'cat-1', name: 'Granos' }]))
  })

  it('exige nombre y precio sin llamar al servidor', async () => {
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Escribe el nombre del producto.')).toBeInTheDocument()
    expect(screen.getByText('Escribe precio de venta.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('pide el costo cuando se indican existencias iniciales', async () => {
    renderNew()
    await userEvent.type(screen.getByLabelText('Nombre del producto'), 'Arroz')
    await userEvent.type(screen.getByLabelText('Precio de venta'), '4200')
    await userEvent.type(screen.getByLabelText('Cantidad actual'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Escribe cuánto te costó cada unidad.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('envía los números escritos a la colombiana y abre la ficha del producto', async () => {
    rpc.mockResolvedValue({ data: 'producto-1', error: null })
    renderNew()

    await userEvent.type(screen.getByLabelText('Nombre del producto'), '  Arroz Diana ')
    await userEvent.type(screen.getByLabelText('Precio de venta'), '4.200')
    await userEvent.selectOptions(screen.getByLabelText('Se vende por'), 'kg')
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Categoría (opcional)' }),
      'cat-1',
    )
    await userEvent.type(screen.getByLabelText('Cantidad actual'), '10,5')
    await userEvent.type(screen.getByLabelText('Costo por unidad'), '3.000')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByText('Destino /productos/:productId')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('create_product', {
      p_business_id: 'negocio-1',
      p_name: 'Arroz Diana',
      p_sale_price: 4200,
      p_unit: 'kg',
      p_low_stock_threshold: 0,
      p_category_id: 'cat-1',
      p_initial_quantity: 10.5,
      p_initial_unit_cost: 3000,
      p_idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })

  it('muestra un mensaje entendible si la referencia ya existe', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate_sku' } })
    renderNew()

    await userEvent.type(screen.getByLabelText('Nombre del producto'), 'Gaseosa')
    await userEvent.type(screen.getByLabelText('Precio de venta'), '2500')
    await userEvent.type(screen.getByLabelText('Referencia o código interno'), 'GAS-1')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya tienes otro producto con esa referencia.',
    )
  })

  it('«Guardar y agregar otro» limpia el formulario y usa una clave nueva', async () => {
    rpc.mockResolvedValue({ data: 'producto-1', error: null })
    renderNew()

    for (const name of ['Pan', 'Leche']) {
      await userEvent.type(screen.getByLabelText('Nombre del producto'), name)
      await userEvent.type(screen.getByLabelText('Precio de venta'), '1000')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar y agregar otro' }))
      expect(
        await screen.findByText(`Guardamos «${name}». Ya puedes agregar el siguiente.`),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Nombre del producto')).toHaveValue('')
    }

    const keys = rpc.mock.calls.map(
      ([, args]) => (args as { p_idempotency_key: string }).p_idempotency_key,
    )
    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe(keys[1])
  })
})
