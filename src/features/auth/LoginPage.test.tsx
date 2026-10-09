import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const signInWithPassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } },
}))

function renderPage() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
  })

  it('muestra errores junto a cada campo sin llamar al servidor', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Escribe un correo válido.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('envía el correo limpio y muestra un mensaje claro si las credenciales fallan', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    renderPage()

    await userEvent.type(screen.getByLabelText('Correo'), ' ana@tienda.co ')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-incorrecta')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@tienda.co',
      password: 'clave-incorrecta',
    })
  })
})
