import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import type { z } from 'zod'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SelectField } from '../../components/ui/SelectField'
import { Spinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { toDecimalInput } from '../../lib/decimal'
import { toUserMessage } from '../../lib/errors'
import { useActiveBusiness } from '../business/BusinessContext'
import {
  createProduct,
  fetchCategories,
  fetchProduct,
  invalidateInventory,
  productKeys,
  updateProduct,
  type Product,
} from './api'
import { newProductSchema, type NewProductValues } from './schemas'
import { UNITS, type Unit } from './units'

type FormInput = z.input<typeof newProductSchema>

const EMPTY: FormInput = {
  name: '',
  salePrice: '',
  unit: 'unidad',
  categoryId: '',
  sku: '',
  barcode: '',
  lowStockThreshold: '',
  initialQuantity: '',
  initialUnitCost: '',
}

function toFormInput(product: Product): FormInput {
  return {
    ...EMPTY,
    name: product.name,
    salePrice: toDecimalInput(product.sale_price),
    unit: product.unit as Unit,
    categoryId: product.category_id ?? '',
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    lowStockThreshold: product.low_stock_threshold
      ? toDecimalInput(product.low_stock_threshold)
      : '',
  }
}

function ProductForm({ product }: { product: Product | null }) {
  const business = useActiveBusiness()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [savedName, setSavedName] = useState<string | null>(null)
  const isNew = product === null

  const categories = useQuery({
    queryKey: productKeys.categories(business.id),
    queryFn: () => fetchCategories(business.id),
  })

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormInput, unknown, NewProductValues>({
    resolver: zodResolver(newProductSchema),
    defaultValues: product ? toFormInput(product) : EMPTY,
  })

  const mutation = useMutation({
    mutationFn: async ({ values }: { values: NewProductValues; addAnother: boolean }) => {
      if (!product) return createProduct({ businessId: business.id, values, idempotencyKey })
      await updateProduct({ businessId: business.id, productId: product.id, values })
      return product.id
    },
    onSuccess: async (productId, { values, addAnother }) => {
      await invalidateInventory(queryClient, business.id)
      if (addAnother) {
        setSavedName(values.name)
        setIdempotencyKey(crypto.randomUUID())
        reset(EMPTY)
        setFocus('name')
        return
      }
      navigate(`/productos/${productId}`, {
        state: { flash: isNew ? 'Producto creado.' : 'Cambios guardados.' },
      })
    },
  })

  const submit = (addAnother: boolean) =>
    handleSubmit((values) => {
      setSavedName(null)
      mutation.mutate({ values, addAnother })
    })

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-col gap-5">
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      {savedName && (
        <Alert tone="success">Guardamos «{savedName}». Ya puedes agregar el siguiente.</Alert>
      )}

      <Card className="flex flex-col gap-4">
        <TextField
          label="Nombre del producto"
          placeholder="Ej.: Arroz Diana 500 g"
          autoFocus={isNew}
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Precio de venta"
          inputMode="decimal"
          placeholder="Ej.: 2.500"
          error={errors.salePrice?.message}
          {...register('salePrice')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Se vende por"
            options={UNITS}
            error={errors.unit?.message}
            {...register('unit')}
          />
          <SelectField
            label="Categoría (opcional)"
            placeholder="Sin categoría"
            options={categoryOptions}
            error={errors.categoryId?.message}
            {...register('categoryId')}
          />
        </div>
      </Card>

      {isNew && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">¿Cuántos tienes ahora?</h2>
            <p className="text-sm text-slate-600">
              Si no lo sabes, déjalo vacío y regístralo después con una entrada.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Cantidad actual"
              inputMode="decimal"
              placeholder="Ej.: 24"
              hint="Usa coma para decimales: 1,5"
              error={errors.initialQuantity?.message}
              {...register('initialQuantity')}
            />
            <TextField
              label="Costo por unidad"
              inputMode="decimal"
              placeholder="Ej.: 1.800"
              hint="Lo que pagaste por cada uno. Sirve para calcular tu ganancia."
              error={errors.initialUnitCost?.message}
              {...register('initialUnitCost')}
            />
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Datos opcionales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Referencia o código interno"
            error={errors.sku?.message}
            {...register('sku')}
          />
          <TextField
            label="Código de barras"
            inputMode="numeric"
            error={errors.barcode?.message}
            {...register('barcode')}
          />
        </div>
        <TextField
          label="Avisarme cuando queden"
          inputMode="decimal"
          placeholder="Ej.: 5"
          hint="Te mostramos una alerta al llegar a esta cantidad. Vacío: solo cuando se agote."
          error={errors.lowStockThreshold?.message}
          {...register('lowStockThreshold')}
        />
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" loading={mutation.isPending && !mutation.variables?.addAnother}>
          {isNew ? 'Guardar producto' : 'Guardar cambios'}
        </Button>
        {isNew && (
          <Button
            variant="secondary"
            onClick={submit(true)}
            loading={mutation.isPending && mutation.variables?.addAnother}
          >
            Guardar y agregar otro
          </Button>
        )}
        <Link
          to={product ? `/productos/${product.id}` : '/productos'}
          className="self-center px-4 py-2 text-sm font-medium text-slate-600 underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}

export function ProductFormPage() {
  const business = useActiveBusiness()
  const { productId } = useParams()

  const product = useQuery({
    queryKey: productKeys.detail(business.id, productId ?? ''),
    queryFn: () => fetchProduct(business.id, productId ?? ''),
    enabled: Boolean(productId),
  })

  const title = productId ? 'Editar producto' : 'Nuevo producto'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {!productId ? (
        <ProductForm product={null} />
      ) : product.isError ? (
        <Alert tone="error">{toUserMessage(product.error)}</Alert>
      ) : product.isPending ? (
        <Spinner />
      ) : product.data === null ? (
        <Alert tone="error">No encontramos este producto.</Alert>
      ) : (
        <ProductForm key={product.data.id} product={product.data} />
      )}
    </div>
  )
}
