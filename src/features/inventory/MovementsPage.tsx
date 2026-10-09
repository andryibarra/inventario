import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Spinner } from '../../components/ui/Spinner'
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from '../../lib/csv'
import { toUserMessage } from '../../lib/errors'
import { useActiveBusiness } from '../business/BusinessContext'
import { unitShort } from '../products/units'
import { useCanWrite } from '../subscription/useCanWrite'
import { fetchMovements, movementKeys, type Movement, type MovementGroup } from './api'
import { MovementList } from './MovementList'
import { MOVEMENT_LABELS } from './movementLabels'

const PAGE = 50
const EXPORT_LIMIT = 10_000

const GROUPS: { value: MovementGroup; param: string | null; label: string }[] = [
  { value: 'all', param: null, label: 'Todos' },
  { value: 'in', param: 'entradas', label: 'Entradas' },
  { value: 'out', param: 'salidas', label: 'Salidas' },
  { value: 'adjustment', param: 'ajustes', label: 'Ajustes' },
]

function exportColumns(timeZone: string): CsvColumn<Movement>[] {
  const dateTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return [
    { header: 'Fecha', value: (m) => dateTime.format(new Date(m.created_at)) },
    { header: 'Producto', value: (m) => m.product_name },
    { header: 'Tipo', value: (m) => MOVEMENT_LABELS[m.movement_type] },
    { header: 'Cantidad', value: (m) => m.quantity_delta },
    { header: 'Unidad', value: (m) => unitShort(m.unit) },
    { header: 'Costo unitario', value: (m) => m.unit_cost },
    { header: 'Saldo después', value: (m) => m.balance_after },
    { header: 'Costo promedio después', value: (m) => m.average_cost_after },
    { header: 'Motivo', value: (m) => m.reason },
  ]
}

export function MovementsPage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(PAGE)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)

  const group = GROUPS.find((g) => g.param === params.get('tipo'))?.value ?? 'all'
  const query = { group, limit }

  const movements = useQuery({
    queryKey: movementKeys.list(business.id, query),
    queryFn: () => fetchMovements(business.id, query),
    placeholderData: (previous) => previous,
  })

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const rows = await fetchMovements(business.id, { group: 'all', limit: EXPORT_LIMIT })
      downloadCsv(
        csvFilename('movimientos', business.name),
        toCsv(rows, exportColumns(business.timezone)),
      )
    } catch (error) {
      setExportError(error)
    } finally {
      setExporting(false)
    }
  }

  const list = movements.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Movimientos</h1>
        {canWrite && <LinkButton to="/inventario/registrar">Registrar movimiento</LinkButton>}
      </div>

      {exportError !== null && <Alert tone="error">{toUserMessage(exportError)}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar movimientos" className="flex flex-wrap gap-2">
          {GROUPS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={group === item.value}
              onClick={() => {
                setLimit(PAGE)
                setParams(item.param ? { tipo: item.param } : {}, { replace: true })
              }}
              className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${
                group === item.value
                  ? 'bg-brand-700 text-white ring-brand-700'
                  : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="ml-auto text-sm"
          loading={exporting}
          onClick={handleExport}
        >
          Exportar
        </Button>
      </div>

      {movements.isError ? (
        <Alert tone="error">{toUserMessage(movements.error)}</Alert>
      ) : movements.isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="Sin movimientos todavía">
          Aquí verás cada entrada, salida y ajuste, con fecha y cantidad.
        </EmptyState>
      ) : (
        <Card className="py-2">
          <MovementList
            movements={list}
            currency={business.currency}
            timeZone={business.timezone}
          />
          {list.length === limit && (
            <Button
              variant="ghost"
              fullWidth
              loading={movements.isFetching}
              onClick={() => setLimit((current) => current + PAGE)}
            >
              Ver más
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
