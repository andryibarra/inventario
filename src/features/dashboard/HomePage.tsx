import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Card } from '../../components/ui/Card'
import { LinkButton } from '../../components/ui/LinkButton'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatQuantity } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { fetchMovements, fetchSummary, movementKeys } from '../inventory/api'
import { MovementList } from '../inventory/MovementList'
import { fetchProducts, productKeys } from '../products/api'
import { unitShort } from '../products/units'
import { useCanWrite } from '../subscription/useCanWrite'

type Step = { label: string; done: boolean; to: string }

const RECENT = { limit: 5 }
const LOW_STOCK = { filter: 'low', search: '', categoryId: null } as const

function StatTile({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand-600"
    >
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-2xl font-bold text-slate-900 tabular-nums">{value}</span>
    </Link>
  )
}

export function HomePage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)

  const summary = useQuery({
    queryKey: movementKeys.summary(business.id),
    queryFn: () => fetchSummary(business.id),
  })
  const recent = useQuery({
    queryKey: movementKeys.list(business.id, RECENT),
    queryFn: () => fetchMovements(business.id, RECENT),
  })
  const lowStock = useQuery({
    queryKey: productKeys.list(business.id, LOW_STOCK),
    queryFn: () => fetchProducts(business.id, LOW_STOCK),
  })

  const hasProducts = (summary.data?.activeProducts ?? 0) > 0
  const hasMovements = (recent.data?.length ?? 0) > 0
  const steps: Step[] = [
    { label: 'Crear tu negocio', done: true, to: '/configuracion' },
    { label: 'Agregar tu primer producto', done: hasProducts, to: '/productos/nuevo' },
    {
      label: 'Registrar una entrada o una salida',
      done: hasMovements,
      to: '/inventario/registrar',
    },
  ]
  const doneCount = steps.filter((step) => step.done).length
  const showSteps = summary.isSuccess && recent.isSuccess && doneCount < steps.length
  const error = summary.error ?? recent.error ?? lowStock.error

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>

      {error && <Alert tone="error">{toUserMessage(error)}</Alert>}

      {showSteps && (
        <Card aria-labelledby="pasos-titulo">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="pasos-titulo" className="text-lg font-semibold">
              Primeros pasos
            </h2>
            <span className="text-sm text-slate-500">
              {doneCount} de {steps.length}
            </span>
          </div>
          <ol className="flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    step.done ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step.done ? '✓' : '·'}
                </span>
                {step.done || !canWrite ? (
                  <span className={step.done ? 'text-slate-500 line-through' : 'text-slate-900'}>
                    {step.label}
                    <span className="sr-only">{step.done ? ' (hecho)' : ' (pendiente)'}</span>
                  </span>
                ) : (
                  <Link to={step.to} className="font-medium text-brand-700 underline">
                    {step.label}
                    <span className="sr-only"> (pendiente)</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {canWrite && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <LinkButton to="/inventario/registrar?tipo=entrada">Registrar entrada</LinkButton>
          <LinkButton to="/inventario/registrar?tipo=salida" variant="secondary">
            Registrar salida
          </LinkButton>
          <LinkButton to="/productos/nuevo" variant="secondary">
            Agregar producto
          </LinkButton>
          <LinkButton to="/inventario/registrar?tipo=ajuste" variant="secondary">
            Ajustar conteo
          </LinkButton>
        </div>
      )}

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Productos activos"
          value={summary.data ? formatQuantity(summary.data.activeProducts) : '—'}
          to="/productos"
        />
        <StatTile
          label="Con stock bajo o agotados"
          value={summary.data ? formatQuantity(summary.data.lowStockProducts) : '—'}
          to="/productos?filtro=bajo"
        />
        <StatTile
          label="Valor del inventario (a costo)"
          value={summary.data ? formatMoney(summary.data.stockValue, business.currency) : '—'}
          to="/productos"
        />
      </section>

      {(lowStock.data?.length ?? 0) > 0 && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">Por reponer</h2>
            <Link to="/productos?filtro=bajo" className="text-sm text-brand-700 underline">
              Ver todos
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {lowStock.data?.slice(0, 5).map((product) => (
              <li key={product.id}>
                <Link
                  to={`/productos/${product.id}`}
                  className="flex items-center justify-between gap-3 py-2 hover:underline"
                >
                  <span className="truncate">{product.name}</span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      product.quantity === 0 ? 'text-red-700' : 'text-amber-800'
                    }`}
                  >
                    {product.quantity === 0
                      ? 'Agotado'
                      : `${formatQuantity(product.quantity)} ${unitShort(product.unit)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasMovements && recent.data && (
        <Card>
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">Últimos movimientos</h2>
            <Link to="/inventario" className="text-sm text-brand-700 underline">
              Ver historial
            </Link>
          </div>
          <MovementList
            movements={recent.data}
            currency={business.currency}
            timeZone={business.timezone}
          />
        </Card>
      )}
    </div>
  )
}
