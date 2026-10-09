import { describe, expect, it } from 'vitest'
import { headerScore, suggestMapping } from './columns'
import { parseUnit } from './units'

describe('suggestMapping', () => {
  it('reconoce encabezados distintos a los de la plantilla', () => {
    const mapping = suggestMapping([
      'DESCRIPCIÓN',
      'P.V.P',
      'Existencias',
      'Cód. Barras',
      'Ref',
      'Valor compra',
      'Línea',
    ])
    expect(mapping).toMatchObject({
      name: 0,
      sale_price: 1,
      quantity: 2,
      barcode: 3,
      sku: 4,
      cost: 5,
      category: 6,
      unit: null,
      low_stock_threshold: null,
    })
  })

  it('distingue "código" (referencia) de "código de barras"', () => {
    expect(suggestMapping(['Código', 'Código de barras', 'Nombre'])).toMatchObject({
      sku: 0,
      barcode: 1,
      name: 2,
    })
  })

  it('reconoce encabezados largos que contienen el nombre del dato', () => {
    expect(suggestMapping(['Nombre', 'Precio de venta al público'])).toMatchObject({
      sale_price: 1,
    })
  })

  it('no asigna la misma columna a dos datos', () => {
    const mapping = suggestMapping(['Precio', 'Valor'])
    expect(mapping.sale_price).toBe(0)
    expect(mapping.cost).toBeNull()
  })

  it('puntúa más alto una fila de encabezados que una de datos', () => {
    expect(headerScore(['Nombre', 'Precio', 'Cantidad'])).toBe(3)
    expect(headerScore(['Arroz', 2500, 10])).toBe(0)
  })
})

describe('parseUnit', () => {
  it.each([
    ['Kilos', 'kg'],
    ['UND', 'unidad'],
    ['Lts', 'l'],
    ['gr', 'g'],
    ['Paquetes', 'paquete'],
  ])('lee "%s" como %s', (input, expected) => {
    expect(parseUnit(input)).toBe(expected)
  })

  it('devuelve null si no la reconoce', () => {
    expect(parseUnit('bulto')).toBeNull()
  })
})
