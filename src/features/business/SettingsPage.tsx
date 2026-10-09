import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { useAuth, useUser } from '../auth/AuthContext'
import { useSubscription } from '../subscription/useSubscription'
import { businessKeys, canManageBusiness, updateBusiness } from './api'
import { useActiveBusiness } from './BusinessContext'
import { BUSINESS_TYPES } from './businessTypes'
import { businessSchema } from './schemas'

function BusinessForm() {
  const business = useActiveBusiness()
  const user = useUser()
  const queryClient = useQueryClient()
  const { access } = useSubscription(business.id)
  const readOnly = !canManageBusiness(business.role) || access?.canWrite === false

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: business.name, businessType: business.business_type ?? '' },
  })

  const mutation = useMutation({
    mutationFn: updateBusiness,
    onSuccess: async (_, input) => {
      reset({ name: input.name, businessType: input.businessType ?? '' })
      await queryClient.invalidateQueries({ queryKey: businessKeys.memberships(user.id) })
    },
  })

  const onSubmit = handleSubmit((values) =>
    mutation.mutate({ ...values, businessId: business.id, timezone: business.timezone }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      {mutation.isSuccess && !isDirty && <Alert tone="success">Cambios guardados.</Alert>}
      {!canManageBusiness(business.role) && (
        <Alert tone="info">Solo el dueño o un administrador puede cambiar estos datos.</Alert>
      )}
      <TextField
        label="Nombre del negocio"
        disabled={readOnly}
        error={errors.name?.message}
        {...register('name')}
      />
      <SelectField
        label="Tipo de negocio"
        placeholder="Sin especificar"
        options={BUSINESS_TYPES}
        disabled={readOnly}
        error={errors.businessType?.message}
        {...register('businessType')}
      />
      {!readOnly && (
        <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
          Guardar cambios
        </Button>
      )}
    </form>
  )
}

export function SettingsPage() {
  const auth = useAuth()
  const user = useUser()
  const business = useActiveBusiness()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-lg font-semibold">Tu negocio</h2>
        {/* key: al cambiar de negocio el formulario se reinicia con sus datos */}
        <BusinessForm key={business.id} />
        <Link
          to="/crear-negocio"
          className="mt-5 inline-block text-sm font-medium text-brand-700 underline"
        >
          Crear otro negocio
        </Link>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 text-lg font-semibold">Tu cuenta</h2>
        <p className="mb-4 break-all text-slate-600">{user.email}</p>
        <Button variant="secondary" onClick={() => void auth.signOut()}>
          Cerrar sesión
        </Button>
      </section>
    </div>
  )
}
