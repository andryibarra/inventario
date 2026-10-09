import { Link } from 'react-router'
import { formatDateTime, formatDelta, formatMoney, formatQuantity } from '../../lib/format'
import { unitShort } from '../products/units'
import type { Movement } from './api'
import { MOVEMENT_LABELS } from './movementLabels'

type MovementListProps = {
  movements: Movement[]
  currency: string
  timeZone: string
  /** En la ficha de un producto no hace falta repetir su nombre. */
  showProduct?: boolean
}

export function MovementList({
  movements,
  currency,
  timeZone,
  showProduct = true,
}: MovementListProps) {
  return (
    <ul className="divide-y divide-slate-100">
      {movements.map((movement) => {
        const unit = unitShort(movement.unit)
        const positive = movement.quantity_delta > 0
        return (
          <li key={movement.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              {showProduct && (
                <Link
                  to={`/productos/${movement.product_id}`}
                  className="block truncate font-medium text-slate-900 hover:underline"
                >
                  {movement.product_name}
                </Link>
              )}
              <p className={showProduct ? 'text-sm text-slate-600' : 'font-medium text-slate-900'}>
                {MOVEMENT_LABELS[movement.movement_type]}
                {movement.movement_type === 'purchase' &&
                  ` a ${formatMoney(movement.unit_cost, currency)} c/u`}
              </p>
              {movement.reason && (
                <p className="text-sm break-words text-slate-500">{movement.reason}</p>
              )}
              <p className="text-xs text-slate-400">
                {formatDateTime(movement.created_at, timeZone)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={`font-semibold tabular-nums ${positive ? 'text-brand-700' : 'text-red-700'}`}
              >
                {formatDelta(movement.quantity_delta)} {unit}
              </p>
              <p className="text-xs text-slate-500">
                Quedan {formatQuantity(movement.balance_after)}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
