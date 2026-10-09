import { z } from 'zod'
import { decimalField, optionalDecimalField, optionalText } from '../../lib/schemas'
import { UNIT_VALUES } from './units'

const productFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre del producto.')
    .max(200, 'El nombre debe tener máximo 200 caracteres.'),
  salePrice: decimalField({ label: 'Precio de venta', maxDecimals: 2 }),
  unit: z.enum(UNIT_VALUES, { message: 'Elige una unidad.' }),
  categoryId: z.string().transform((value) => value || null),
  sku: optionalText(60, 'Referencia'),
  barcode: optionalText(60, 'Código de barras'),
  lowStockThreshold: optionalDecimalField({ label: 'Aviso de stock bajo', maxDecimals: 3 }, 0),
}

export const productSchema = z.object(productFields)

export const newProductSchema = z
  .object({
    ...productFields,
    initialQuantity: optionalDecimalField({ label: 'Cantidad actual', maxDecimals: 3 }, 0),
    initialUnitCost: optionalDecimalField({ label: 'Costo por unidad', maxDecimals: 2 }, null),
  })
  .superRefine((values, ctx) => {
    if (values.initialQuantity > 0 && values.initialUnitCost === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['initialUnitCost'],
        message: 'Escribe cuánto te costó cada unidad.',
      })
    }
  })

export type ProductValues = z.output<typeof productSchema>
export type NewProductValues = z.output<typeof newProductSchema>

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de la categoría.')
    .max(60, 'Máximo 60 caracteres.'),
})
