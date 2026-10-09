import { z } from 'zod'
import { decimalPlaces, normalizeDecimal } from './decimal'

type DecimalOptions = {
  label: string
  maxDecimals: number
  /** true: debe ser mayor que cero. */
  positive?: boolean
}

/**
 * Campo numérico escrito a la colombiana ("2.500", "1,5"). Entrega un número
 * ya validado (decimales y rango) para enviarlo a la base de datos.
 */
export function decimalField({ label, maxDecimals, positive = false }: DecimalOptions) {
  return z.string().transform((text, ctx) => {
    const normalized = normalizeDecimal(text)
    if (normalized === null) {
      ctx.addIssue({
        code: 'custom',
        message: text.trim()
          ? `${label}: escribe solo números.`
          : `Escribe ${label.toLowerCase()}.`,
      })
      return z.NEVER
    }
    if (decimalPlaces(normalized) > maxDecimals) {
      ctx.addIssue({
        code: 'custom',
        message:
          maxDecimals === 0
            ? `${label}: sin decimales.`
            : `${label}: máximo ${maxDecimals} decimales.`,
      })
      return z.NEVER
    }
    const value = Number(normalized)
    if (positive && value <= 0) {
      ctx.addIssue({ code: 'custom', message: `${label}: debe ser mayor que cero.` })
      return z.NEVER
    }
    if (value >= 1e10) {
      ctx.addIssue({ code: 'custom', message: `${label}: el número es demasiado grande.` })
      return z.NEVER
    }
    return value
  })
}

/** Como decimalField, pero vacío se permite y se convierte en `whenEmpty`. */
export function optionalDecimalField<T extends number | null>(
  options: DecimalOptions,
  whenEmpty: T,
) {
  return z.union([z.literal('').transform(() => whenEmpty), decimalField(options)])
}

export function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres.`)
    .transform((value) => value || null)
}
