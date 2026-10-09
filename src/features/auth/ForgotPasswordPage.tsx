import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { AuthCard } from '../../components/ui/AuthCard'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { forgotPasswordSchema } from './schemas'

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-clave`,
    })
    if (error) {
      setServerError(toUserMessage(error))
      return
    }
    setSent(true)
  })

  return (
    <AuthCard title="Recuperar contraseña">
      {sent ? (
        <Alert tone="success">
          Si existe una cuenta con ese correo, te enviamos un enlace para crear una contraseña
          nueva.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <TextField
            label="Correo de tu cuenta"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" loading={isSubmitting} fullWidth>
            Enviar enlace
          </Button>
        </form>
      )}
      <Link to="/ingresar" className="mt-5 block text-center text-sm text-brand-700 underline">
        Volver a ingresar
      </Link>
    </AuthCard>
  )
}
