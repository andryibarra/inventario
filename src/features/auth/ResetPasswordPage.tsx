import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { AuthCard } from '../../components/ui/AuthCard'
import { Button } from '../../components/ui/Button'
import { FullPageSpinner } from '../../components/ui/FullPageSpinner'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthContext'
import { resetPasswordSchema } from './schemas'

export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setServerError(toUserMessage(error))
      return
    }
    navigate('/', { replace: true })
  })

  if (auth.status === 'loading') return <FullPageSpinner />

  // El enlace del correo crea la sesión. Sin sesión, el enlace venció o ya se usó.
  if (auth.status === 'signedOut') {
    return (
      <AuthCard title="Enlace no válido">
        <p className="text-slate-700">
          El enlace venció o ya fue usado. Pide uno nuevo para cambiar tu contraseña.
        </p>
        <Link
          to="/recuperar-clave"
          className="mt-6 block text-center font-semibold text-brand-700 underline"
        >
          Pedir un enlace nuevo
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Nueva contraseña">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" loading={isSubmitting} fullWidth>
          Guardar contraseña
        </Button>
      </form>
    </AuthCard>
  )
}
