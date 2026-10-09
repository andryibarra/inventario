import { describe, expect, it } from 'vitest'
import type { Product } from '../products/api'
import { addToCart, cartTotals, type CartLine } from './cart'

const arroz = { id: 'p1', name: 'Arroz', unit: 'unidad', quantity: 5, sale_price: 2800 } as Product
const queso = { id: 'p2', name: 'Queso', unit: 'kg', quantity: 2.5, sale_price: 18000 } as Product

describe('carrito', () => {
  it('agrega productos y suma una unidad si ya están', () => {
    let lines = addToCart([], arroz)
    lines = addToCart(lines, queso)
    lines = addToCart(lines, arroz)
    expect(lines.map((line) => [line.name, line.quantity, line.unitPrice])).toEqual([
      ['Arroz', '2', '2800'],
      ['Queso', '1', '18000'],
    ])
  })

  it('calcula subtotal, descuento y total sin errores de redondeo', () => {
    const lines: CartLine[] = [
      {
        productId: 'p1',
        name: 'Arroz',
        unit: 'unidad',
        available: 5,
        quantity: '3',
        unitPrice: '2.800',
      },
      {
        productId: 'p2',
        name: 'Queso',
        unit: 'kg',
        available: 2.5,
        quantity: '0,333',
        unitPrice: '17000',
      },
    ]
    const totals = cartTotals(lines, '400')
    // 3 × 2800 + 0,333 × 17000 = 8400 + 5661
    expect(totals).toMatchObject({ subtotal: 14061, discount: 400, total: 13661, valid: true })
  })

  it('no permite vender más de lo disponible ni cantidades vacías', () => {
    const lines: CartLine[] = [
      {
        productId: 'p1',
        name: 'Arroz',
        unit: 'unidad',
        available: 5,
        quantity: '6',
        unitPrice: '2800',
      },
      {
        productId: 'p2',
        name: 'Queso',
        unit: 'kg',
        available: 2.5,
        quantity: '',
        unitPrice: '18000',
      },
    ]
    const totals = cartTotals(lines, '')
    expect(totals.valid).toBe(false)
    expect(totals.checks).toEqual([
      { ok: false, error: 'Solo hay 5 disponibles.' },
      { ok: false, error: 'Escribe una cantidad mayor que cero.' },
    ])
  })

  it('rechaza un descuento mayor que el subtotal', () => {
    const lines: CartLine[] = [
      {
        productId: 'p1',
        name: 'Arroz',
        unit: 'unidad',
        available: 5,
        quantity: '1',
        unitPrice: '2800',
      },
    ]
    expect(cartTotals(lines, '3.000')).toMatchObject({
      valid: false,
      discountError: 'El descuento no puede ser mayor que el subtotal.',
      total: 2800,
    })
  })

  it('un carrito vacío no es válido', () => {
    expect(cartTotals([], '').valid).toBe(false)
  })
})
