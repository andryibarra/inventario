import { z } from 'zod'

const email = z.string().trim().pipe(z.email('Escribe un correo válido.'))

const newPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña debe tener máximo 72 caracteres.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre.')
    .max(80, 'El nombre debe tener máximo 80 caracteres.'),
  email,
  password: newPassword,
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    error: 'Las contraseñas no coinciden.',
  })
