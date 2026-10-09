import { describe, expect, it } from 'vitest'
import { suggestMapping } from './columns'
import {
  buildPreview,
  countPreview,
  DEFAULT_OPTIONS,
  detectHeaderRow,
  rowsToImport,
  type ExistingProduct,
} from './preview'
import type { Cell } from './readFile'

const EXISTING: ExistingProduct[] = [
  { id: 'p-gas', name: 'Gaseosa 400 ml', sku: 'GAS-1', barcode: '7701', quantity: 10 },
  { id: 'p-pan', name: 'Pan tajado', sku: null, barcode: null, quantity: 3 },
]

function preview(rows: Cell[][], options = DEFAULT_OPTIONS) {
  const header = detectHeaderRow(rows)
  return buildPreview(rows, header, suggestMapping(rows[header] ?? []), EXISTING, options)
}

describe('detectHeaderRow', () => {
  it('salta títulos y filas vacías por encima de los encabezados', () => {
    const rows: Cell[][] = [
      ['INVENTARIO TIENDA DOÑA ROSA', null],
      [null, null],
      ['Producto', 'Precio', 'Cantidad'],
      ['Arroz', 2500, 3],
    ]
    expect(detectHeaderRow(rows)).toBe(2)
  })
})

describe('buildPreview', () => {
  const HEADER: Cell[] = ['Nombre', 'Precio', 'Cantidad', 'Costo', 'Referencia', 'Unidad']

  it('interpreta números de Excel (tolerando el ruido de las fórmulas) y escritos a la colombiana', () => {
    const [row] = preview([HEADER, ['Arroz', '2.500', '10,5', 1800.0000000001, 'ARR', 'Kilos']])
    expect(row).toMatchObject({
      rowNumber: 2,
      status: 'new',
      payload: {
        row: 2,
        name: 'Arroz',
        sale_price: 2500,
        quantity: 10.5,
        cost: 1800,
        sku: 'ARR',
        unit: 'kg',
      },
    })
  })

  it('omite las filas vacías y numera como Excel', () => {
    const rows = preview([HEADER, [null, null], ['Arroz', 100], ['', ' '], ['Sal', 200]])
    expect(rows.map((row) => row.rowNumber)).toEqual([3, 5])
  })

  it('marca errores por fila con un motivo claro', () => {
    const rows = preview([
      HEADER,
      ['Sin precio', null],
      [null, 100],
      ['Precio raro', 'mil'],
      ['Negativo', 100, -2],
      ['Muchos decimales', 100.123],
      ['Bulto', 100, 1, 1, null, 'bulto'],
    ])
    expect(rows.map((row) => [row.status, row.messages[0]])).toEqual([
      ['error', 'Falta el precio de venta.'],
      ['error', 'Falta el nombre del producto.'],
      ['error', 'Precio de venta: «mil» no es un número válido.'],
      ['error', 'Cantidad: no puede ser negativo.'],
      ['error', 'Precio de venta: máximo 2 decimales.'],
      ['error', expect.stringMatching(/^Unidad «bulto» no reconocida/)],
    ])
  })

  it('reconoce productos existentes por referencia o código, nunca solo por el nombre', () => {
    const rows = preview([
      ['Nombre', 'Precio', 'Referencia', 'Código de barras'],
      ['Gaseosa grande', 3000, 'gas-1', null],
      ['Otra', 3000, null, '7701'],
      ['Pan tajado', 4000, null, null],
    ])
    expect(rows.map((row) => row.status)).toEqual(['skip', 'skip', 'duplicate'])
    expect(rows[2]?.messages[0]).toBe('Ya tienes un producto llamado «Pan tajado».')
  })

  it('actualiza existentes solo con permiso y avisa el cambio de cantidad', () => {
    const rows = preview(
      [
        ['Referencia', 'Precio', 'Cantidad'],
        ['GAS-1', 2800, 7],
      ],
      { ...DEFAULT_OPTIONS, updateExisting: true, adjustStock: true },
    )
    expect(rows[0]).toMatchObject({
      status: 'update',
      messages: ['Se actualizan los datos de «Gaseosa 400 ml».', 'Cantidad: 10 → 7.'],
    })
  })

  it('detecta repetidos dentro del mismo archivo', () => {
    const rows = preview([
      ['Nombre', 'Precio', 'Referencia'],
      ['Leche', 3000, 'LEC'],
      ['Leche deslactosada', 3500, 'lec'],
      ['Huevos', 500, null],
      ['huevos', 500, null],
    ])
    expect(rows.map((row) => [row.status, row.messages[0]])).toEqual([
      ['new', undefined],
      ['error', 'La referencia se repite: ya está en la fila 2.'],
      ['new', undefined],
      ['duplicate', 'El nombre se repite: ya está en la fila 4.'],
    ])
  })

  it('rechaza referencia y código que apuntan a productos distintos', () => {
    const existing = [
      ...EXISTING,
      { id: 'p-x', name: 'Jabón', sku: 'JAB', barcode: '9999', quantity: 1 },
    ]
    const rows: Cell[][] = [
      ['Nombre', 'Precio', 'Referencia', 'Código de barras'],
      ['X', 1, 'JAB', '7701'],
    ]
    const [row] = buildPreview(rows, 0, suggestMapping(rows[0] ?? []), existing, DEFAULT_OPTIONS)
    expect(row?.status).toBe('error')
  })

  it('avisa (sin bloquear) cuando falta el costo de un producto con existencias', () => {
    const [row] = preview([HEADER, ['Arroz', 2500, 10]])
    expect(row).toMatchObject({
      status: 'new',
      messages: ['Sin costo: no se podrá calcular la ganancia de este producto.'],
    })
  })
})

describe('rowsToImport', () => {
  const rows: Cell[][] = [
    ['Nombre', 'Precio', 'Referencia'],
    ['Nuevo', 100, null],
    ['Gaseosa', 2800, 'GAS-1'],
    ['Pan tajado', 4000, null],
    ['Malo', 'x', null],
  ]

  it('por defecto solo envía los productos nuevos', () => {
    const result = preview(rows)
    expect(countPreview(result)).toEqual({ new: 1, update: 0, skip: 1, duplicate: 1, error: 1 })
    expect(rowsToImport(result, DEFAULT_OPTIONS).map((row) => row.name)).toEqual(['Nuevo'])
  })

  it('con las opciones marcadas envía también existentes y repetidos', () => {
    const options = { updateExisting: true, adjustStock: false, includeDuplicates: true }
    const result = preview(rows, options)
    expect(rowsToImport(result, options).map((row) => row.row)).toEqual([2, 3, 4])
  })
})
