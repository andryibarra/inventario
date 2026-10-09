import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SelectField } from '../../components/ui/SelectField'
import { TextField } from '../../components/ui/TextField'
import { formatMoney, formatQuantity } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { invalidateInventory } from '../products/api'
import { ProductPicker } from '../products/ProductPicker'
import { unitShort } from '../products/units'
import { useCanWrite } from '../subscription/useCanWrite'
import { createSale, PAYMENT_METHODS, saleErrorMessage, saleKeys, type PaymentMethod } from './api'
import { addToCart, cartTotals, type CartLine } from './cart'

function CartLineRow({
  line,
  error,
  currency,
  onChange,
  onRemove,
}: {
  line: CartLine
  error: string | null
  currency: string
  onChange: (line: CartLine) => void
  onRemove: () => void
}) {
  const id = useId()
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium break-words text-slate-900">{line.name}</p>
          <p className="text-xs text-slate-500">
            Disponible: {formatQuantity(line.available)} {unitShort(line.unit)}
          </p>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 text-sm text-red-700"
          onClick={onRemove}
          aria-label={`Quitar ${line.name}`}
        >
          Quitar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id={`${id}-qty`}
          label={`Cantidad (${unitShort(line.unit)})`}
          inputMode="decimal"
          value={line.quantity}
          onChange={(event) => onChange({ ...line, quantity: event.target.value })}
        />
        <TextField
          id={`${id}-price`}
          label={`Precio c/u (${currency})`}
          inputMode="decimal"
          value={line.unitPrice}
          onChange={(event) => onChange({ ...line, unitPrice: event.target.value })}
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export function NewSalePage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [lines, setLines] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discount, setDiscount] = useState('')
  const [note, setNote] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const totals = cartTotals(lines, discount)

  const mutation = useMutation({
    mutationFn: createSale,
    onSuccess: async (saleId) => {
      await Promise.all([
        invalidateInventory(queryClient, business.id),
        queryClient.invalidateQueries({ queryKey: saleKeys.all(business.id) }),
      ])
      navigate(`/ventas/${saleId}`, { state: { flash: 'Venta registrada.' } })
    },
  })

  if (!canWrite) {
    return (
      <Alert tone="warning">
        Tu suscripción no está activa. Puedes consultar tus datos, pero no registrar ventas.
      </Alert>
    )
  }

  function submit() {
    setShowErrors(true)
    if (!totals.valid) return
    mutation.mutate({
      businessId: business.id,
      items: lines.map((line, index) => {
        const check = totals.checks[index]
        if (!check?.ok) throw new Error('Línea inválida')
        return { product_id: line.productId, quantity: check.quantity, unit_price: check.unitPrice }
      }),
      paymentMethod,
      discount: totals.discount,
      note: note.trim() || null,
      idempotencyKey,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link to="/ventas" className="text-sm font-medium text-brand-700 underline">
          ← Ventas
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Nueva venta</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <ProductPicker
            label="Agregar producto"
            clearOnPick
            showPrice
            onPick={(product) => {
              setLines((current) => addToCart(current, product))
              mutation.reset()
            }}
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            {lines.length === 0
              ? 'Productos de la venta'
              : `Productos de la venta (${lines.length})`}
          </h2>
          {lines.length === 0 ? (
            <p className="text-slate-600">
              Busca y toca los productos que vendes. También puedes usar un lector de código de
              barras.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lines.map((line, index) => {
                const check = totals.checks[index]
                return (
                  <CartLineRow
                    key={line.productId}
                    line={line}
                    currency={business.currency}
                    error={showErrors && check && !check.ok ? check.error : null}
                    onChange={(next) =>
                      setLines((current) =>
                        current.map((item) => (item.productId === next.productId ? next : item)),
                      )
                    }
                    onRemove={() =>
                      setLines((current) =>
                        current.filter((item) => item.productId !== line.productId),
                      )
                    }
                  />
                )
              })}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Medio de pago"
              options={PAYMENT_METHODS}
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            />
            <TextField
              label="Descuento (opcional)"
              inputMode="decimal"
              placeholder="0"
              value={discount}
              error={totals.discountError ?? undefined}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </div>
          <TextField
            label="Nota (opcional)"
            placeholder="Ej.: nombre del cliente"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          <dl className="flex flex-col gap-1 border-t border-slate-100 pt-3">
            {totals.discount > 0 && !totals.discountError && (
              <>
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatMoney(totals.subtotal, business.currency)}
                  </dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>Descuento</dt>
                  <dd className="tabular-nums">
                    −{formatMoney(totals.discount, business.currency)}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between text-xl font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(totals.total, business.currency)}</dd>
            </div>
          </dl>

          {mutation.isError && <Alert tone="error">{saleErrorMessage(mutation.error)}</Alert>}
          {showErrors && lines.length === 0 && (
            <Alert tone="error">Agrega al menos un producto.</Alert>
          )}

          <Button fullWidth loading={mutation.isPending} onClick={submit}>
            Registrar venta
          </Button>
          <p className="text-xs text-slate-500">
            Este registro sirve para tu control de inventario y ventas. No es una factura
            electrónica.
          </p>
        </Card>
      </div>
    </div>
  )
}
