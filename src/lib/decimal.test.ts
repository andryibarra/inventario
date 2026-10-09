import { describe, expect, it } from 'vitest'
import { decimalPlaces, normalizeDecimal } from './decimal'

describe('normalizeDecimal', () => {
  it.each([
    ['2500', '2500'],
    ['2.500', '2500'],
    ['1.250.000', '1250000'],
    ['2.500,75', '2500.75'],
    ['1,5', '1.5'],
    ['1.5', '1.5'],
    ['0,250', '0.250'],
    ['$ 12.000', '12000'],
    [' 007 ', '7'],
    ['0', '0'],
  ])('lee "%s" como %s', (input, expected) => {
    expect(normalizeDecimal(input)).toBe(expected)
  })

  it.each(['', '  ', 'abc', '-5', '1,2,3', '1.2.3', '1e5', '12,', ',5'])(
    'rechaza "%s"',
    (input) => {
      expect(normalizeDecimal(input)).toBeNull()
    },
  )
})

describe('decimalPlaces', () => {
  it('cuenta los decimales del texto normalizado', () => {
    expect(decimalPlaces('12')).toBe(0)
    expect(decimalPlaces('1.5')).toBe(1)
    expect(decimalPlaces('0.250')).toBe(3)
  })
})
