import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, NETWORK_ERROR, toUserMessage } from './errors'

describe('toUserMessage', () => {
  it('traduce las excepciones de nuestras funciones SQL', () => {
    expect(toUserMessage({ code: '42501', message: 'forbidden' })).toBe(
      'No tienes permiso para hacer esta acción.',
    )
    expect(toUserMessage({ code: 'P0001', message: 'subscription_inactive' })).toMatch(
      /no está activa/,
    )
  })

  it('traduce los códigos de error de Auth', () => {
    expect(
      toUserMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('Correo o contraseña incorrectos.')
  })

  it('reconoce fallos de red', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR)
  })

  it('no muestra mensajes técnicos desconocidos', () => {
    expect(toUserMessage({ message: 'duplicate key value violates unique constraint' })).toBe(
      GENERIC_ERROR,
    )
    expect(toUserMessage(null)).toBe(GENERIC_ERROR)
    expect(toUserMessage('texto')).toBe(GENERIC_ERROR)
  })
})
