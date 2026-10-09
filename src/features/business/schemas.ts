import { z } from 'zod'

export const businessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de tu negocio.')
    .max(120, 'El nombre debe tener máximo 120 caracteres.'),
  businessType: z
    .string()
    .max(60)
    .transform((value) => value || null),
})
