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
import { signupSchema } from './schemas'

export function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signupSchema) })

  const onSubmit = handleSubmit(async ({ displayName, email, password }) => {
    setServerError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    })
    if (error) {
      setServerError(toUserMessage(error))
      return
    }
    // Con confirmación de correo activa no hay sesión hasta abrir el enlace.
    // Si el correo ya existía, Supabase responde igual (no revela cuentas).
    if (!data.session) setSentTo(email)
  })

  if (sentTo) {
    return (
      <AuthCard title="Revisa tu correo">
        <p className="text-slate-700">
          Te enviamos un enlace a <strong className="break-all">{sentTo}</strong>. Ábrelo para
          activar tu cuenta y continuar.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Si no lo ves en unos minutos, revisa la carpeta de spam.
        </p>
        <Link to="/ingresar" className="mt-6 block text-center text-brand-700 underline">
          Volver a ingresar
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Crear cuenta">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <TextField
          label="Tu nombre"
          autoComplete="name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
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
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting} fullWidth>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link to="/ingresar" className="font-semibold text-brand-700 underline">
          Ingresar
        </Link>
      </p>
    </AuthCard>
  )
}
