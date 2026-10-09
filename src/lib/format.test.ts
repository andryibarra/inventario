import { describe, expect, it } from 'vitest'
import { formatDelta, formatMoney, formatQuantity } from './format'

// Intl usa espacios especiales (NBSP); se normalizan para comparar.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('format', () => {
  it('muestra pesos con separador de miles y sin decimales innecesarios', () => {
    expect(plain(formatMoney(2500))).toBe('$ 2.500')
    expect(plain(formatMoney(1100.5))).toBe('$ 1.100,5')
  })

  it('muestra cantidades con coma decimal y punto de miles', () => {
    expect(formatQuantity(10.5)).toBe('10,5')
    expect(formatQuantity(1500)).toBe('1.500')
  })

  it('muestra el signo de los movimientos', () => {
    expect(formatDelta(5)).toBe('+5')
    expect(formatDelta(-2.5)).toBe('−2,5')
  })
})
