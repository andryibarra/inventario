import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { canManageBusiness } from '../business/api'
import { useActiveBusiness } from '../business/BusinessContext'
import { useCanWrite } from '../subscription/useCanWrite'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  invalidateInventory,
  productKeys,
  renameCategory,
  type Category,
} from './api'
import { categorySchema } from './schemas'

function useRefreshCategories() {
  const business = useActiveBusiness()
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: productKeys.categories(business.id) })
    // Los productos muestran el nombre de su categoría.
    await invalidateInventory(queryClient, business.id)
  }
}

function NewCategoryForm() {
  const business = useActiveBusiness()
  const refresh = useRefreshCategories()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(categorySchema), defaultValues: { name: '' } })

  const mutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      reset()
      await refresh()
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate({ businessId: business.id, ...values }))}
      noValidate
      className="flex flex-col gap-3"
    >
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      <div className="flex items-start gap-2">
        <TextField
          label="Nueva categoría"
          placeholder="Ej.: Bebidas"
          className="flex-1"
          error={errors.name?.message}
          {...register('name')}
        />
        <Button type="submit" className="mt-6" loading={mutation.isPending}>
          Agregar
        </Button>
      </div>
    </form>
  )
}

function CategoryRow({ category, canDelete }: { category: Category; canDelete: boolean }) {
  const business = useActiveBusiness()
  const refresh = useRefreshCategories()
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: category.name },
  })

  const rename = useMutation({
    mutationFn: renameCategory,
    onSuccess: async () => {
      setMode('view')
      await refresh()
    },
  })
  const remove = useMutation({ mutationFn: deleteCategory, onSuccess: refresh })
  const error = rename.error ?? remove.error

  return (
    <li className="flex flex-col gap-2 py-3">
      {error && <Alert tone="error">{toUserMessage(error)}</Alert>}
      {mode === 'rename' ? (
        <form
          onSubmit={handleSubmit((values) =>
            rename.mutate({ businessId: business.id, categoryId: category.id, ...values }),
          )}
          noValidate
          className="flex flex-wrap items-start gap-2"
        >
          <TextField
            label="Nombre"
            className="min-w-48 flex-1"
            autoFocus
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="mt-6 flex gap-2">
            <Button type="submit" loading={rename.isPending}>
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => setMode('view')}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : mode === 'delete' ? (
        <div className="flex flex-col gap-2">
          <p className="text-slate-700">
            ¿Borrar «{category.name}»? Sus productos no se borran: quedan sin categoría.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => remove.mutate({ businessId: business.id, categoryId: category.id })}
            >
              Sí, borrar
            </Button>
            <Button variant="secondary" onClick={() => setMode('view')}>
              No, volver
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Link
            to={`/productos?categoria=${category.id}`}
            className="truncate font-medium text-slate-900 hover:underline"
          >
            {category.name}
          </Link>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" className="text-sm" onClick={() => setMode('rename')}>
              Cambiar nombre
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                className="text-sm text-red-700"
                onClick={() => setMode('delete')}
              >
                Borrar
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export function CategoriesPage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const categories = useQuery({
    queryKey: productKeys.categories(business.id),
    queryFn: () => fetchCategories(business.id),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link to="/productos" className="text-sm font-medium text-brand-700 underline">
          ← Productos
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Categorías</h1>
        <p className="text-slate-600">
          Agrupan tus productos para encontrarlos más rápido. Son opcionales.
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        {canWrite && <NewCategoryForm />}
        {categories.isError ? (
          <Alert tone="error">{toUserMessage(categories.error)}</Alert>
        ) : categories.isPending ? (
          <Spinner />
        ) : categories.data.length === 0 ? (
          <p className="py-3 text-slate-600">Todavía no tienes categorías.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.data.map((category) =>
              canWrite ? (
                <CategoryRow
                  key={category.id}
                  category={category}
                  canDelete={canManageBusiness(business.role)}
                />
              ) : (
                <li key={category.id} className="py-3 font-medium">
                  {category.name}
                </li>
              ),
            )}
          </ul>
        )}
      </Card>
    </div>
  )
}
