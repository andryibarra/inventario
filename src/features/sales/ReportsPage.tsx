import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatQuantity } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { unitShort } from '../products/units'
import { fetchSalesSummary, fetchTopProducts, saleKeys } from './api'
import { PeriodPicker } from './PeriodPicker'
import { describePeriod } from './periods'
import { usePeriod } from './usePeriod'

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-2xl font-bold text-slate-900 tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  )
}

function percent(part: number, whole: number): string {
  if (whole === 0) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 }).format(
    part / whole,
  )
}

export function ReportsPage() {
  const business = useActiveBusiness()
  const { period, setPeriod, today } = usePeriod(business.timezone, 'month')
  const money = (value: number) => formatMoney(value, business.currency)

  const summary = useQuery({
    queryKey: saleKeys.summary(business.id, period),
    queryFn: () => fetchSalesSummary(business.id, period),
    placeholderData: (previous) => previous,
  })
  const top = useQuery({
    queryKey: saleKeys.top(business.id, period),
    queryFn: () => fetchTopProducts(business.id, period),
    placeholderData: (previous) => previous,
  })

  const data = summary.data
  const error = summary.error ?? top.error

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
      <PeriodPicker period={period} today={today} onChange={setPeriod} />

      {error ? (
        <Alert tone="error">{toUserMessage(error)}</Alert>
      ) : !data ? (
        <Spinner />
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {describePeriod(period)} ·{' '}
            {data.salesCount === 1 ? '1 venta' : `${formatQuantity(data.salesCount)} ventas`}
            {data.cancelledCount > 0 &&
              ` (${data.cancelledCount === 1 ? '1 anulada' : `${data.cancelledCount} anuladas`}, no se cuentan)`}
          </p>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Ventas"
              value={money(data.total)}
              {...(data.discountTotal > 0
                ? { hint: `Después de ${money(data.discountTotal)} en descuentos` }
                : {})}
            />
            <Metric label="Costo de lo vendido" value={money(data.costTotal)} />
            <Metric
              label="Margen bruto estimado"
              value={money(data.grossMargin)}
              hint={`${percent(data.grossMargin, data.total)} de las ventas`}
            />
            <Metric
              label="Venta promedio"
              value={data.salesCount > 0 ? money(Math.round(data.total / data.salesCount)) : '—'}
            />
          </dl>

          <Alert tone="info">
            El margen bruto estimado es lo vendido menos lo que te costó esa mercancía (a costo
            promedio). No descuenta arriendo, servicios, sueldos, impuestos ni comisiones, así que
            no es tu ganancia neta.
          </Alert>

          <Card>
            <h2 className="mb-2 text-lg font-semibold">Más vendidos</h2>
            {!top.data || top.data.length === 0 ? (
              <p className="text-slate-600">No hay ventas en este periodo.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Producto</th>
                      <th className="py-2 pr-3 text-right font-medium">Cantidad</th>
                      <th className="py-2 pr-3 text-right font-medium">Vendido</th>
                      <th className="py-2 text-right font-medium">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {top.data.map((product) => (
                      <tr key={product.product_id}>
                        <td className="py-2 pr-3">
                          <Link to={`/productos/${product.product_id}`} className="hover:underline">
                            {product.product_name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatQuantity(product.quantity)} {unitShort(product.unit)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {money(product.revenue)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {money(product.revenue - product.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pt-2 text-xs text-slate-500">
                  Valores por producto antes de los descuentos generales de cada venta.
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
