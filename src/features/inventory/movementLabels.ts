import type { MovementType } from './api'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  initial: 'Existencias iniciales',
  purchase: 'Entrada',
  output: 'Salida',
  adjustment: 'Ajuste por conteo',
  sale: 'Venta',
  sale_reversal: 'Venta anulada',
  return: 'Devolución',
}

export const OUTPUT_REASONS = [
  { value: 'Dañado o vencido', label: 'Dañado o vencido' },
  { value: 'Consumo del negocio', label: 'Consumo del negocio' },
  { value: 'Regalo o muestra', label: 'Regalo o muestra' },
  { value: 'Pérdida o robo', label: 'Pérdida o robo' },
  { value: 'Venta sin registrar', label: 'Venta que no se registró' },
  { value: 'Otro', label: 'Otro' },
] as const
