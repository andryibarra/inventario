// Formatos de presentación (es-CO). Solo para mostrar: los cálculos de dinero
// y cantidades se hacen en la base de datos.

const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(value: number, currency = 'COP'): string {
  let formatter = moneyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    moneyFormatters.set(currency, formatter)
  }
  return formatter.format(value)
}

const quantityFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value)
}

/** Cantidad con signo explícito, para movimientos: "+5", "−2,5". */
export function formatDelta(value: number): string {
  const abs = formatQuantity(Math.abs(value))
  return value > 0 ? `+${abs}` : `−${abs}`
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso))
}
