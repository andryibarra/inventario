import { z } from 'zod'
import { decimalField, optionalText } from '../../lib/schemas'

export const entrySchema = z.object({
  quantity: decimalField({ label: 'Cantidad', maxDecimals: 3, positive: true }),
  unitCost: decimalField({ label: 'Costo por unidad', maxDecimals: 2 }),
  note: optionalText(200, 'Nota'),
})

export const outputSchema = z
  .object({
    quantity: decimalField({ label: 'Cantidad', maxDecimals: 3, positive: true }),
    reason: z.string().min(1, 'Elige el motivo de la salida.'),
    note: optionalText(150, 'Detalle'),
  })
  .transform(({ quantity, reason, note }) => ({
    quantity,
    reason: note ? `${reason}: ${note}` : reason,
  }))

export const adjustmentSchema = z.object({
  countedQuantity: decimalField({ label: 'Cantidad contada', maxDecimals: 3 }),
  reason: z
    .string()
    .trim()
    .min(1, 'Escribe el motivo del ajuste.')
    .max(200, 'Máximo 200 caracteres.'),
})
