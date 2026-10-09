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
import { loginSchema } from './schemas'

export function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) })

  // Si el ingreso funciona, <PublicOnly> redirige solo al detectar la sesión.
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setServerError(toUserMessage(error))
  })

  return (
    <AuthCard title="Ingresar">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <TextField
          label="Correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting} fullWidth>
          Ingresar
        </Button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-center text-sm">
        <Link to="/recuperar-clave" className="text-brand-700 underline">
          Olvidé mi contraseña
        </Link>
        <p className="text-slate-600">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold text-brand-700 underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
