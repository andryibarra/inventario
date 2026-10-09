import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { AuthCard } from '../../components/ui/AuthCard'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { useUser } from '../auth/AuthContext'
import { businessKeys, createBusiness } from './api'
import { useBusinesses } from './BusinessContext'
import { BUSINESS_TYPES } from './businessTypes'
import { businessSchema } from './schemas'

export function CreateBusinessPage() {
  const user = useUser()
  const { memberships, setActiveId } = useBusinesses()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isFirst = memberships.length === 0

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: '', businessType: '' },
  })

  const mutation = useMutation({
    mutationFn: createBusiness,
    onSuccess: async (businessId) => {
      setActiveId(businessId)
      await queryClient.invalidateQueries({ queryKey: businessKeys.memberships(user.id) })
      navigate('/', { replace: true })
    },
  })

  const onSubmit = handleSubmit((values) => mutation.mutate(values))

  return (
    <AuthCard title={isFirst ? 'Crea tu negocio' : 'Nuevo negocio'}>
      {isFirst && (
        <p className="mb-5 text-slate-600">
          Solo necesitamos el nombre. Tienes 7 días de prueba gratis, sin tarjeta.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
        <TextField
          label="Nombre del negocio"
          placeholder="Ej.: Tienda Doña Rosa"
          autoComplete="organization"
          error={errors.name?.message}
          {...register('name')}
        />
        <SelectField
          label="Tipo de negocio (opcional)"
          placeholder="Selecciona…"
          options={BUSINESS_TYPES}
          error={errors.businessType?.message}
          {...register('businessType')}
        />
        <Button type="submit" loading={mutation.isPending} fullWidth>
          Crear negocio
        </Button>
      </form>
      {!isFirst && (
        <Link to="/" className="mt-5 block text-center text-sm text-brand-700 underline">
          Cancelar
        </Link>
      )}
    </AuthCard>
  )
}
