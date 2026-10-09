// Carrito de una venta. Los totales que se muestran se calculan en centavos
// enteros; los definitivos los calcula la base de datos al registrar.

import { decimalPlaces, normalizeDecimal, toDecimalInput } from '../../lib/decimal'
import type { Product } from '../products/api'

export type CartLine = {
  productId: string
  name: string
  unit: string
  available: number
  /** Texto tal como lo escribe la persona ("1,5"). */
  quantity: string
  unitPrice: string
}

export type LineCheck =
  { ok: true; quantity: number; unitPrice: number; cents: number } | { ok: false; error: string }

export function lineFromProduct(product: Product): CartLine {
  return {
    productId: product.id,
    name: product.name,
    unit: product.unit,
    available: product.quantity,
    quantity: '1',
    unitPrice: toDecimalInput(product.sale_price),
  }
}

/** Agrega el producto o, si ya está, suma una unidad. */
export function addToCart(lines: readonly CartLine[], product: Product): CartLine[] {
  const existing = lines.find((line) => line.productId === product.id)
  if (!existing) return [...lines, lineFromProduct(product)]
  const current = Number(normalizeDecimal(existing.quantity) ?? '0')
  return lines.map((line) =>
    line.productId === product.id ? { ...line, quantity: toDecimalInput(current + 1) } : line,
  )
}

export function checkLine(line: CartLine): LineCheck {
  const quantityText = normalizeDecimal(line.quantity)
  if (quantityText === null || Number(quantityText) <= 0) {
    return { ok: false, error: 'Escribe una cantidad mayor que cero.' }
  }
  if (decimalPlaces(quantityText) > 3) return { ok: false, error: 'Máximo 3 decimales.' }
  const quantity = Number(quantityText)
  if (quantity > line.available) {
    return { ok: false, error: `Solo hay ${toDecimalInput(line.available)} disponibles.` }
  }

  const priceText = normalizeDecimal(line.unitPrice)
  if (priceText === null) return { ok: false, error: 'Escribe el precio.' }
  if (decimalPlaces(priceText) > 2) return { ok: false, error: 'Precio: máximo 2 decimales.' }
  const unitPrice = Number(priceText)

  return { ok: true, quantity, unitPrice, cents: Math.round(quantity * unitPrice * 100) }
}

export function cartTotals(lines: readonly CartLine[], discountText: string) {
  const checks = lines.map(checkLine)
  const subtotalCents = checks.reduce((sum, check) => sum + (check.ok ? check.cents : 0), 0)
  const discountNormalized = discountText.trim() === '' ? '0' : normalizeDecimal(discountText)
  const discountCents =
    discountNormalized === null ? null : Math.round(Number(discountNormalized) * 100)
  const discountError =
    discountNormalized === null
      ? 'Escribe solo números.'
      : decimalPlaces(discountNormalized) > 2
        ? 'Máximo 2 decimales.'
        : (discountCents ?? 0) > subtotalCents
          ? 'El descuento no puede ser mayor que el subtotal.'
          : null

  return {
    checks,
    subtotal: subtotalCents / 100,
    discount: (discountCents ?? 0) / 100,
    total: (subtotalCents - (discountError ? 0 : (discountCents ?? 0))) / 100,
    discountError,
    valid: lines.length > 0 && checks.every((check) => check.ok) && discountError === null,
  }
}
