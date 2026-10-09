import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Spinner } from '../../components/ui/Spinner'
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from '../../lib/csv'
import { toUserMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { useCanWrite } from '../subscription/useCanWrite'
import { fetchSales, paymentLabel, saleKeys, type Sale } from './api'
import { PeriodPicker } from './PeriodPicker'
import { describePeriod } from './periods'
import { periodSearch, usePeriod } from './usePeriod'

function timeFormatter(timeZone: string, withDate: boolean) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone,
    ...(withDate ? { day: 'numeric', month: 'short' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  })
}

function exportColumns(timeZone: string): CsvColumn<Sale>[] {
  const dateTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return [
    { header: 'Venta', value: (s) => s.number },
    { header: 'Fecha', value: (s) => dateTime.format(new Date(s.created_at)) },
    { header: 'Estado', value: (s) => (s.status === 'cancelled' ? 'Anulada' : 'Registrada') },
    { header: 'Medio de pago', value: (s) => paymentLabel(s.payment_method) },
    { header: 'Subtotal', value: (s) => s.subtotal },
    { header: 'Descuento', value: (s) => s.discount_total },
    { header: 'Total', value: (s) => s.total },
    { header: 'Costo estimado', value: (s) => s.cost_total },
    { header: 'Nota', value: (s) => s.note },
  ]
}

export function SalesPage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const { period, setPeriod, today } = usePeriod(business.timezone)

  const sales = useQuery({
    queryKey: saleKeys.list(business.id, period),
    queryFn: () => fetchSales(business.id, period, business.timezone),
    placeholderData: (previous) => previous,
  })

  const list = sales.data ?? []
  const completed = list.filter((sale) => sale.status === 'completed')
  const total = completed.reduce((sum, sale) => sum + Math.round(sale.total * 100), 0) / 100
  const format = timeFormatter(business.timezone, period.from !== period.to)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        {canWrite && <LinkButton to="/ventas/nueva">Nueva venta</LinkButton>}
      </div>

      <PeriodPicker period={period} today={today} onChange={setPeriod} />

      {sales.isError ? (
        <Alert tone="error">{toUserMessage(sales.error)}</Alert>
      ) : sales.isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState
          title={`Sin ventas: ${describePeriod(period)}`}
          action={canWrite && <LinkButton to="/ventas/nueva">Registrar una venta</LinkButton>}
        >
          Cada venta descuenta las existencias y queda aquí con su detalle.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-slate-700">
              <strong className="text-slate-900">{formatMoney(total, business.currency)}</strong> en{' '}
              {completed.length === 1 ? '1 venta' : `${completed.length} ventas`} ·{' '}
              {describePeriod(period)}
            </p>
            <div className="flex gap-1">
              <LinkButton
                to={`/reportes?${periodSearch(period)}`}
                variant="ghost"
                className="text-sm"
              >
                Ver reporte
              </LinkButton>
              <Button
                variant="ghost"
                className="text-sm"
                onClick={() =>
                  downloadCsv(
                    csvFilename('ventas', business.name),
                    toCsv(list, exportColumns(business.timezone)),
                  )
                }
              >
                Exportar
              </Button>
            </div>
          </div>
          <ul
            aria-label="Lista de ventas"
            className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
          >
            {list.map((sale) => (
              <li key={sale.id}>
                <Link
                  to={`/ventas/${sale.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">Venta {sale.number}</p>
                    <p className="truncate text-sm text-slate-500">
                      {format.format(new Date(sale.created_at))} ·{' '}
                      {paymentLabel(sale.payment_method)}
                      {sale.note && ` · ${sale.note}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`font-semibold tabular-nums ${sale.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                    >
                      {formatMoney(sale.total, business.currency)}
                    </span>
                    {sale.status === 'cancelled' && <Badge tone="danger">Anulada</Badge>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
