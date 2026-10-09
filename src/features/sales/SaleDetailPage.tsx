import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FlashMessage } from '../../components/ui/FlashMessage'
import { LinkButton } from '../../components/ui/LinkButton'
import { Spinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { formatDateTime, formatMoney, formatQuantity } from '../../lib/format'
import { canManageBusiness } from '../business/api'
import { useActiveBusiness } from '../business/BusinessContext'
import { invalidateInventory } from '../products/api'
import { unitShort } from '../products/units'
import { useCanWrite } from '../subscription/useCanWrite'
import { cancelSale, fetchSale, paymentLabel, saleKeys, type SaleWithItems } from './api'

function CancelSection({ sale }: { sale: SaleWithItems }) {
  const business = useActiveBusiness()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [showError, setShowError] = useState(false)

  const mutation = useMutation({
    mutationFn: cancelSale,
    onSuccess: async () => {
      setOpen(false)
      await Promise.all([
        invalidateInventory(queryClient, business.id),
        queryClient.invalidateQueries({ queryKey: saleKeys.all(business.id) }),
      ])
    },
  })

  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">¿Te equivocaste o el cliente devolvió todo?</p>
        <Button variant="ghost" className="text-red-700" onClick={() => setOpen(true)}>
          Anular venta
        </Button>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-slate-700">
        Al anular, las existencias de cada producto vuelven al inventario. La venta no se borra:
        queda marcada como anulada con el motivo.
      </p>
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      <TextField
        label="Motivo"
        placeholder="Ej.: el cliente devolvió los productos"
        maxLength={200}
        autoFocus
        value={reason}
        error={showError && !reason.trim() ? 'Escribe el motivo de la anulación.' : undefined}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          loading={mutation.isPending}
          onClick={() => {
            setShowError(true)
            if (reason.trim()) {
              mutation.mutate({ businessId: business.id, saleId: sale.id, reason: reason.trim() })
            }
          }}
        >
          Sí, anular venta
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          No, volver
        </Button>
      </div>
    </Card>
  )
}

function SaleDetail({ sale }: { sale: SaleWithItems }) {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const money = (value: number) => formatMoney(value, sale.currency)
  const margin = sale.total - sale.cost_total
  const items = [...sale.items].sort((a, b) => a.product_name.localeCompare(b.product_name))

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link to="/ventas" className="text-sm font-medium text-brand-700 underline">
          ← Ventas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Venta {sale.number}</h1>
          {sale.status === 'cancelled' && <Badge tone="danger">Anulada</Badge>}
        </div>
        <p className="text-sm text-slate-500">
          {formatDateTime(sale.created_at, business.timezone)} · {paymentLabel(sale.payment_method)}
        </p>
      </div>

      <FlashMessage />
      {sale.status === 'cancelled' && sale.cancelled_at && (
        <Alert tone="warning">
          Anulada el {formatDateTime(sale.cancelled_at, business.timezone)}. Motivo:{' '}
          {sale.cancel_reason}. Las existencias volvieron al inventario.
        </Alert>
      )}

      <Card className="flex flex-col gap-3">
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link
                  to={`/productos/${item.product_id}`}
                  className="font-medium break-words text-slate-900 hover:underline"
                >
                  {item.product_name}
                </Link>
                <p className="text-sm text-slate-500">
                  {formatQuantity(item.quantity)} {unitShort(item.unit)} × {money(item.unit_price)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-slate-100 pt-3">
          {sale.discount_total > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{money(sale.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Descuento</dt>
                <dd className="tabular-nums">−{money(sale.discount_total)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between text-xl font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(sale.total)}</dd>
          </div>
          <div className="mt-2 flex justify-between text-sm text-slate-600">
            <dt>Costo de la mercancía (estimado)</dt>
            <dd className="tabular-nums">{money(sale.cost_total)}</dd>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <dt>Margen bruto estimado</dt>
            <dd className="tabular-nums">{money(margin)}</dd>
          </div>
        </dl>
        {sale.note && <p className="text-sm text-slate-600">Nota: {sale.note}</p>}
        <p className="text-xs text-slate-500">
          Registro interno de venta. No es una factura electrónica.
        </p>
      </Card>

      {canWrite && <LinkButton to="/ventas/nueva">Nueva venta</LinkButton>}

      {canWrite && sale.status === 'completed' && canManageBusiness(business.role) && (
        <CancelSection sale={sale} />
      )}
    </>
  )
}

export function SaleDetailPage() {
  const business = useActiveBusiness()
  const { saleId = '' } = useParams()
  const sale = useQuery({
    queryKey: saleKeys.detail(business.id, saleId),
    queryFn: () => fetchSale(business.id, saleId),
  })

  return (
    <div className="flex flex-col gap-4">
      {sale.isError ? (
        <Alert tone="error">{toUserMessage(sale.error)}</Alert>
      ) : sale.isPending ? (
        <Spinner />
      ) : sale.data === null ? (
        <Alert tone="error">
          No encontramos esta venta.{' '}
          <Link to="/ventas" className="underline">
            Ver ventas
          </Link>
        </Alert>
      ) : (
        <SaleDetail sale={sale.data} />
      )}
    </div>
  )
}
