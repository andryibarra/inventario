import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryResult, renderInBusiness } from '../../test/renderInBusiness'
import { ImportPage } from './ImportPage'

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

const EXISTING = [{ id: 'p-gas', name: 'Gaseosa', sku: 'GAS-1', barcode: null, quantity: 10 }]

const CSV = [
  'Producto;P.V.P;Existencias;Ref',
  'Arroz;2.500;10;ARR',
  'Gaseosa grande;3.000;5;gas-1',
  'Sal;mucho;1;',
].join('\n')

function renderPage() {
  renderInBusiness(<ImportPage />, { path: '/productos/importar', url: '/productos/importar' })
}

async function uploadAndPreview() {
  renderPage()
  const input = screen.getByLabelText('Elegir archivo')
  await userEvent.upload(input, new File([CSV], 'inventario.csv', { type: 'text/csv' }))
  expect(await screen.findByText('inventario.csv')).toBeInTheDocument()
  expect(screen.getByLabelText('Nombre del producto')).toHaveValue('0')
  expect(screen.getByLabelText('Precio de venta')).toHaveValue('1')
  await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }))
  await screen.findByRole('table')
}

describe('ImportPage', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    from.mockImplementation((table: string) =>
      queryResult(table === 'product_overview' ? EXISTING : table === 'imports' ? [] : TRIAL),
    )
  })

  it('muestra qué se crea, qué ya existe y qué tiene errores antes de guardar', async () => {
    await uploadAndPreview()

    expect(screen.getByText('Nuevo: 1')).toBeInTheDocument()
    expect(screen.getByText('Ya existe: 1')).toBeInTheDocument()
    expect(screen.getByText('Con error: 1')).toBeInTheDocument()
    expect(screen.getByText('Precio de venta: «mucho» no es un número válido.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('por defecto importa solo los nuevos, con un id de importación', async () => {
    rpc.mockResolvedValue({
      data: {
        import_id: 'x',
        rows_total: 3,
        rows_created: 1,
        rows_updated: 0,
        rows_stock_adjusted: 0,
        rows_skipped: 2,
        already_imported: false,
      },
      error: null,
    })
    await uploadAndPreview()
    await userEvent.click(screen.getByRole('button', { name: 'Importar: crear 1' }))

    expect(await screen.findByText('Importación terminada.')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('import_products', {
      p_business_id: 'negocio-1',
      p_import_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_file_name: 'inventario.csv',
      p_rows: [{ row: 2, name: 'Arroz', sale_price: 2500, quantity: 10, sku: 'ARR' }],
      p_update_existing: false,
      p_adjust_stock: false,
      p_rows_total: 3,
      p_rows_invalid: 2,
    })
  })

  it('actualizar existentes y reemplazar cantidades requiere marcarlo', async () => {
    rpc.mockResolvedValue({ data: { already_imported: false }, error: null })
    await uploadAndPreview()

    const adjust = screen.getByLabelText(
      'También reemplazar su cantidad disponible por la del archivo',
    )
    expect(adjust).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Actualizar el producto que ya existe'))
    await userEvent.click(adjust)
    await userEvent.click(screen.getByRole('button', { name: 'Importar: crear 1 y actualizar 1' }))

    expect(rpc).toHaveBeenCalledWith(
      'import_products',
      expect.objectContaining({
        p_rows: [expect.objectContaining({ row: 2 }), expect.objectContaining({ row: 3 })],
        p_update_existing: true,
        p_adjust_stock: true,
      }),
    )
  })

  it('si el servidor rechaza una fila, dice cuál y que no se importó nada', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'import_row_failed',
        details: '{"row": 2, "error": "duplicate_barcode"}',
      },
    })
    await uploadAndPreview()
    await userEvent.click(screen.getByRole('button', { name: 'Importar: crear 1' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se importó nada. Fila 2: Ya tienes otro producto con ese código de barras.',
    )
  })

  it('rechaza archivos de otro tipo con un mensaje claro', async () => {
    renderPage()
    await userEvent.upload(
      screen.getByLabelText('Elegir archivo'),
      new File(['x'], 'foto.png', { type: 'image/png' }),
      { applyAccept: false },
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese tipo de archivo no se puede')
  })
})
