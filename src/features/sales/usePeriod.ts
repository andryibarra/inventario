import { useSearchParams } from 'react-router'
import { addDays, presetPeriod, todayIn, type Period, type PeriodKey } from './periods'

const PARAM: Record<PeriodKey, string> = {
  today: 'hoy',
  yesterday: 'ayer',
  week: 'semana',
  month: 'mes',
  custom: 'fechas',
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Periodo elegido, guardado en la URL (?periodo=semana) para poder compartir el enlace. */
export function usePeriod(timeZone: string, fallback: Exclude<PeriodKey, 'custom'> = 'today') {
  const [params, setParams] = useSearchParams()
  const today = todayIn(timeZone)
  const key =
    (Object.keys(PARAM) as PeriodKey[]).find((k) => PARAM[k] === params.get('periodo')) ?? fallback

  let period: Period
  if (key === 'custom') {
    const from = params.get('desde') ?? ''
    const to = params.get('hasta') ?? ''
    period =
      DAY.test(from) && DAY.test(to) && from <= to
        ? { key, from, to }
        : { key, from: addDays(today, -29), to: today }
  } else {
    period = presetPeriod(key, today)
  }

  function setPeriod(next: Period) {
    setParams(
      next.key === 'custom'
        ? { periodo: PARAM.custom, desde: next.from, hasta: next.to }
        : { periodo: PARAM[next.key] },
      { replace: true },
    )
  }

  return { period, setPeriod, today }
}

/** Parámetros de URL de un periodo, para enlazar a otra pantalla con el mismo periodo. */
export function periodSearch(period: Period): string {
  return new URLSearchParams(
    period.key === 'custom'
      ? { periodo: PARAM.custom, desde: period.from, hasta: period.to }
      : { periodo: PARAM[period.key] },
  ).toString()
}
