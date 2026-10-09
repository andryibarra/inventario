// Lectura de números escritos como se acostumbra en Colombia.
//
//   "2.500"     → 2500     (punto como separador de miles)
//   "2.500,75"  → 2500.75  (coma decimal)
//   "1,5"       → 1.5
//   "1.5"       → 1.5      (punto decimal si no forma grupos de miles)
//   "$ 12.000"  → 12000
//
// Devuelve un texto decimal normalizado ("2500.75") o null si no es un número.
// El valor viaja a la base de datos, que es la que guarda y calcula con
// precisión exacta (numeric).

const THOUSANDS_WITH_DOTS = /^\d{1,3}(\.\d{3})+$/

export function normalizeDecimal(input: string): string | null {
  let text = input.replace(/[\s$]/g, '')
  if (text === '') return null

  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (THOUSANDS_WITH_DOTS.test(text)) {
    text = text.replace(/\./g, '')
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return text.replace(/^0+(?=\d)/, '')
}

export function decimalPlaces(normalized: string): number {
  const dot = normalized.indexOf('.')
  return dot === -1 ? 0 : normalized.length - dot - 1
}

/** Valor guardado → texto para un campo editable, con coma decimal ("1,5"). */
export function toDecimalInput(value: number): string {
  return String(value).replace('.', ',')
}
