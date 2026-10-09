import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FlashMessage } from '../../components/ui/FlashMessage'
import { LinkButton } from '../../components/ui/LinkButton'
import { Spinner } from '../../components/ui/Spinner'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatQuantity } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { fetchMovements, movementKeys } from '../inventory/api'
import { MovementList } from '../inventory/MovementList'
import { useCanWrite } from '../subscription/useCanWrite'
import {
  fetchProduct,
  invalidateInventory,
  productKeys,
  setProductActive,
  type Product,
} from './api'
import { StockBadge } from './StockBadge'
import { unitShort } from './units'

const HISTORY_PAGE = 20

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-xl font-bold text-slate-900 tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  )
}

function ArchiveSection({ product }: { product: Product }) {
  const business = useActiveBusiness()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const mutation = useMutation({
    mutationFn: setProductActive,
    onSuccess: async () => {
      setConfirming(false)
      await invalidateInventory(queryClient, business.id)
    },
  })

  const toggle = () =>
    mutation.mutate({ businessId: business.id, productId: product.id, active: !product.is_active })

  return (
    <Card className="flex flex-col gap-3">
      {mutation.isError && <Alert tone="error">{toUserMessage(mutation.error)}</Alert>}
      {product.is_active ? (
        confirming ? (
          <>
            <p className="text-slate-700">
              ¿Archivar «{product.name}»? Dejará de aparecer en la lista y en las alertas. Su
              historial se conserva y puedes reactivarlo cuando quieras.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" loading={mutation.isPending} onClick={toggle}>
                Sí, archivar
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                No, volver
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">¿Ya no vendes este producto?</p>
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Archivar producto
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Este producto está archivado.</p>
          <Button variant="secondary" loading={mutation.isPending} onClick={toggle}>
            Reactivar producto
          </Button>
        </div>
      )}
    </Card>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const [limit, setLimit] = useState(HISTORY_PAGE)
  const unit = unitShort(product.unit)
  const margin = product.sale_price - product.average_cost
  const movementQuery = { productId: product.id, limit }

  const movements = useQuery({
    queryKey: movementKeys.list(business.id, movementQuery),
    queryFn: () => fetchMovements(business.id, movementQuery),
    placeholderData: (previous) => previous,
  })

  const actionLink = (tipo: string) => `/inventario/registrar?tipo=${tipo}&producto=${product.id}`

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link to="/productos" className="text-sm font-medium text-brand-700 underline">
          ← Productos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold break-words text-slate-900">{product.name}</h1>
          <StockBadge product={product} />
        </div>
        {(product.sku || product.barcode || product.category_name) && (
          <p className="text-sm text-slate-500">
            {[
              product.category_name,
              product.sku && `Ref. ${product.sku}`,
              product.barcode && `Código ${product.barcode}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      <FlashMessage />

      <Card>
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Stat label="Disponible" value={`${formatQuantity(product.quantity)} ${unit}`} />
          <Stat
            label="Precio de venta"
            value={formatMoney(product.sale_price, business.currency)}
          />
          <Stat
            label="Costo promedio"
            value={formatMoney(product.average_cost, business.currency)}
            hint={
              product.average_cost > 0
                ? `Ganancia estimada: ${formatMoney(margin, business.currency)} c/u`
                : undefined
            }
          />
          <Stat label="Valor a costo" value={formatMoney(product.stock_value, business.currency)} />
        </dl>
        {product.is_low_stock && product.is_active && (
          <p className="mt-4 text-sm text-amber-900">
            {product.quantity === 0
              ? 'Este producto está agotado.'
              : `Quedan pocas unidades (avisamos con ${formatQuantity(product.low_stock_threshold)} o menos).`}
          </p>
        )}
      </Card>

      {canWrite && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {product.is_active && (
            <>
              <LinkButton to={actionLink('entrada')}>Entrada</LinkButton>
              <LinkButton to={actionLink('salida')} variant="secondary">
                Salida
              </LinkButton>
            </>
          )}
          <LinkButton to={actionLink('ajuste')} variant="secondary">
            Ajustar conteo
          </LinkButton>
          <LinkButton to={`/productos/${product.id}/editar`} variant="secondary">
            Editar datos
          </LinkButton>
        </div>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Historial</h2>
        {movements.isError ? (
          <Alert tone="error">{toUserMessage(movements.error)}</Alert>
        ) : movements.isPending ? (
          <Spinner />
        ) : movements.data.length === 0 ? (
          <p className="py-3 text-slate-600">
            Todavía no hay movimientos. Registra una entrada cuando recibas mercancía.
          </p>
        ) : (
          <>
            <MovementList
              movements={movements.data}
              currency={business.currency}
              timeZone={business.timezone}
              showProduct={false}
            />
            {movements.data.length === limit && (
              <Button
                variant="ghost"
                fullWidth
                loading={movements.isFetching}
                onClick={() => setLimit((current) => current + HISTORY_PAGE)}
              >
                Ver más
              </Button>
            )}
          </>
        )}
      </Card>

      {canWrite && <ArchiveSection product={product} />}
    </>
  )
}

export function ProductDetailPage() {
  const business = useActiveBusiness()
  const { productId = '' } = useParams()

  const product = useQuery({
    queryKey: productKeys.detail(business.id, productId),
    queryFn: () => fetchProduct(business.id, productId),
  })

  return (
    <div className="flex flex-col gap-4">
      {product.isError ? (
        <Alert tone="error">{toUserMessage(product.error)}</Alert>
      ) : product.isPending ? (
        <Spinner />
      ) : product.data === null ? (
        <Alert tone="error">
          No encontramos este producto.{' '}
          <Link to="/productos" className="underline">
            Ver productos
          </Link>
        </Alert>
      ) : (
        <ProductDetail product={product.data} />
      )}
    </div>
  )
}
