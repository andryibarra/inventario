// Periodos de fechas en la zona horaria del negocio. Las fechas se manejan
// como texto "AAAA-MM-DD" (el día calendario del negocio, no del navegador).

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export type Period = { key: PeriodKey; from: string; to: string }

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  week: 'Últimos 7 días',
  month: 'Este mes',
  custom: 'Otras fechas',
}

/** Día calendario actual en la zona horaria indicada. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone }).format(now)
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function presetPeriod(key: Exclude<PeriodKey, 'custom'>, today: string): Period {
  switch (key) {
    case 'today':
      return { key, from: today, to: today }
    case 'yesterday': {
      const yesterday = addDays(today, -1)
      return { key, from: yesterday, to: yesterday }
    }
    case 'week':
      return { key, from: addDays(today, -6), to: today }
    case 'month':
      return { key, from: `${today.slice(0, 8)}01`, to: today }
  }
}

// Minutos que la zona horaria está adelantada respecto a UTC en ese instante.
function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return Math.round((asUtc - utcMs) / 60_000)
}

/** Instante (ISO, UTC) en que empieza ese día en la zona horaria del negocio. */
export function startOfDay(day: string, timeZone: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const guess = Date.UTC(y, m - 1, d)
  let utc = guess - offsetMinutes(guess, timeZone) * 60_000
  // Segunda pasada por si el cambio de horario cae entre la estimación y el resultado.
  utc = guess - offsetMinutes(utc, timeZone) * 60_000
  return new Date(utc).toISOString()
}

/** Límites [desde, hasta) en UTC para filtrar por created_at. */
export function periodBounds(period: Pick<Period, 'from' | 'to'>, timeZone: string) {
  return {
    since: startOfDay(period.from, timeZone),
    until: startOfDay(addDays(period.to, 1), timeZone),
  }
}

export function describePeriod(period: Period): string {
  const format = (day: string) => {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number]
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)))
  }
  return period.from === period.to
    ? format(period.from)
    : `${format(period.from)} – ${format(period.to)}`
}
