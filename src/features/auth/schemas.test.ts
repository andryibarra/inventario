import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './redirect'
import { loginSchema, resetPasswordSchema, signupSchema } from './schemas'

describe('esquemas de autenticación', () => {
  it('limpia espacios del correo (teclados móviles los agregan)', () => {
    const result = loginSchema.parse({ email: '  ana@tienda.co ', password: 'x' })
    expect(result.email).toBe('ana@tienda.co')
  })

  it('rechaza correos inválidos con un mensaje en español', () => {
    const result = loginSchema.safeParse({ email: 'ana', password: 'x' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Escribe un correo válido.')
  })

  it('exige contraseñas de al menos 8 caracteres al registrarse', () => {
    const result = signupSchema.safeParse({
      displayName: 'Ana',
      email: 'ana@tienda.co',
      password: '1234567',
    })
    expect(result.success).toBe(false)
  })

  it('exige que las contraseñas coincidan al restablecer', () => {
    const result = resetPasswordSchema.safeParse({ password: 'segura123', confirm: 'segura124' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirm'])
  })
})

describe('safeRedirectPath', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirectPath('/configuracion')).toBe('/configuracion')
  })

  it('bloquea redirecciones a otros sitios', () => {
    expect(safeRedirectPath('//malicioso.com')).toBe('/')
    expect(safeRedirectPath('https://malicioso.com')).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
  })
})
