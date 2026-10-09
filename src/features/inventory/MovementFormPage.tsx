import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SelectField } from '../../components/ui/SelectField'
import { Spinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { normalizeDecimal, toDecimalInput } from '../../lib/decimal'
import { toUserMessage } from '../../lib/errors'
import { formatDelta, formatMoney, formatQuantity } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { fetchProduct, invalidateInventory, productKeys, type Product } from '../products/api'
import { ProductPicker } from '../products/ProductPicker'
import { unitShort } from '../products/units'
import { useCanWrite } from '../subscription/useCanWrite'
import { adjustStock, recordMovement } from './api'
import { OUTPUT_REASONS } from './movementLabels'
import { adjustmentSchema, entrySchema, outputSchema } from './schemas'

type Kind = 'entrada' | 'salida' | 'ajuste'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'salida', label: 'Salida' },
  { value: 'ajuste', label: 'Ajuste' },
]

const KIND_HELP: Record<Kind, string> = {
  entrada: 'Mercancía que recibes: compras o pedidos que llegan.',
  salida: 'Mercancía que sale sin venderse: daños, vencidos, consumo del negocio.',
  ajuste: 'Contaste lo que hay y no coincide: deja la cantidad real.',
}

function parseKind(value: string | null): Kind {
  return value === 'salida' || value === 'ajuste' ? value : 'entrada'
}

/** Al terminar, vuelve a la ficha del producto con la confirmación. */
function useMovementMutation<T>(
  product: Product,
  run: (input: T) => Promise<string>,
  flash: string,
) {
  const business = useActiveBusiness()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await invalidateInventory(queryClient, business.id)
      navigate(`/productos/${product.id}`, { state: { flash } })
    },
  })
}

function EntryForm({ product }: { product: Product }) {
  const business = useActiveBusiness()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      quantity: '',
      unitCost: product.average_cost > 0 ? toDecimalInput(product.average_cost) : '',
      note: '',
    },
  })
  const mutation = useMovementMutation(product, recordMovement, 'Entrada registrada.')

  const onSubmit = handleSubmit((values) =>
    mutation.mutate({
      businessId: business.id,
      productId: product.id,
      type: 'purchase',
      quantity: values.quantity,
      unitCost: values.unitCost,
      reason: values.note,
      idempotencyKey,
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={`Cantidad que entra (${unitShort(product.unit)})`}
          inputMode="decimal"
          autoFocus
          error={errors.quantity?.message}
          {...register('quantity')}
        />
        <TextField
          label="Costo por unidad"
          inputMode="decimal"
          hint="Lo que pagaste por cada uno en esta compra."
          error={errors.unitCost?.message}
          {...register('unitCost')}
        />
      </div>
      <TextField
        label="Nota (opcional)"
        placeholder="Ej.: Proveedor, número de factura"
        error={errors.note?.message}
        {...register('note')}
      />
      <Button type="submit" loading={mutation.isPending}>
        Registrar entrada
      </Button>
    </form>
  )
}

function OutputForm({ product }: { product: Product }) {
  const business = useActiveBusiness()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(outputSchema),
    defaultValues: { quantity: '', reason: '', note: '' },
  })
  const mutation = useMovementMutation(product, recordMovement, 'Salida registrada.')

  const onSubmit = handleSubmit((values) =>
    mutation.mutate({
      businessId: business.id,
      productId: product.id,
      type: 'output',
      quantity: values.quantity,
      unitCost: null,
      reason: values.reason,
      idempotencyKey,
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      <TextField
        label={`Cantidad que sale (${unitShort(product.unit)})`}
        inputMode="decimal"
        autoFocus
        hint={`Disponible: ${formatQuantity(product.quantity)}`}
        error={errors.quantity?.message}
        {...register('quantity')}
      />
      <SelectField
        label="Motivo"
        placeholder="Selecciona…"
        options={OUTPUT_REASONS}
        error={errors.reason?.message}
        {...register('reason')}
      />
      <TextField label="Detalle (opcional)" error={errors.note?.message} {...register('note')} />
      <Button type="submit" loading={mutation.isPending}>
        Registrar salida
      </Button>
    </form>
  )
}

function AdjustmentForm({ product }: { product: Product }) {
  const business = useActiveBusiness()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { countedQuantity: '', reason: 'Conteo físico' },
  })
  const mutation = useMovementMutation(product, adjustStock, 'Ajuste registrado.')

  // Vista previa de la diferencia (solo informativa; la calcula la base de datos).
  const counted = normalizeDecimal(useWatch({ control, name: 'countedQuantity' }))
  const difference = counted === null ? null : Number(counted) - product.quantity

  const onSubmit = handleSubmit((values) =>
    mutation.mutate({
      businessId: business.id,
      productId: product.id,
      countedQuantity: values.countedQuantity,
      reason: values.reason,
      idempotencyKey,
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      <TextField
        label={`¿Cuántos contaste? (${unitShort(product.unit)})`}
        inputMode="decimal"
        autoFocus
        hint={`El sistema tiene ${formatQuantity(product.quantity)}.`}
        error={errors.countedQuantity?.message}
        {...register('countedQuantity')}
      />
      {difference !== null && difference !== 0 && (
        <p className="text-sm text-slate-700" role="status">
          Diferencia: <strong>{formatDelta(difference)}</strong> {unitShort(product.unit)}
        </p>
      )}
      <TextField label="Motivo" error={errors.reason?.message} {...register('reason')} />
      <Button type="submit" loading={mutation.isPending}>
        Guardar ajuste
      </Button>
    </form>
  )
}

export function MovementFormPage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const [params, setParams] = useSearchParams()
  const kind = parseKind(params.get('tipo'))
  const productId = params.get('producto')

  const product = useQuery({
    queryKey: productKeys.detail(business.id, productId ?? ''),
    queryFn: () => fetchProduct(business.id, productId ?? ''),
    enabled: Boolean(productId),
  })

  function setParam(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  if (!canWrite) {
    return (
      <Alert tone="warning">
        Tu suscripción no está activa. Puedes consultar tus datos, pero no registrar movimientos.
      </Alert>
    )
  }

  const selected = productId ? product.data : null

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">Registrar movimiento</h1>

      <div
        role="group"
        aria-label="Tipo de movimiento"
        className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
      >
        {KINDS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={kind === item.value}
            onClick={() => setParam('tipo', item.value)}
            className={`min-h-11 rounded-lg text-sm font-semibold ${
              kind === item.value
                ? 'bg-white text-brand-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-600">{KIND_HELP[kind]}</p>

      <Card className="flex flex-col gap-4">
        {!productId ? (
          <ProductPicker onPick={(picked) => setParam('producto', picked.id)} />
        ) : product.isError ? (
          <Alert tone="error">{toUserMessage(product.error)}</Alert>
        ) : product.isPending ? (
          <Spinner />
        ) : !selected ? (
          <Alert tone="error">No encontramos este producto.</Alert>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <p className="font-semibold break-words text-slate-900">{selected.name}</p>
                <p className="text-sm text-slate-500">
                  Disponible: {formatQuantity(selected.quantity)} {unitShort(selected.unit)} · Costo
                  promedio {formatMoney(selected.average_cost, business.currency)}
                </p>
              </div>
              <Button
                variant="ghost"
                className="shrink-0 text-sm"
                onClick={() => setParam('producto', null)}
              >
                Cambiar
              </Button>
            </div>
            {!selected.is_active && kind !== 'ajuste' ? (
              <Alert tone="warning">
                Este producto está archivado. Reactívalo desde su ficha para registrar entradas o
                salidas.
              </Alert>
            ) : kind === 'entrada' ? (
              <EntryForm key={selected.id} product={selected} />
            ) : kind === 'salida' ? (
              <OutputForm key={selected.id} product={selected} />
            ) : (
              <AdjustmentForm key={selected.id} product={selected} />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
