import { describe, expect, it } from 'vitest'
import { addDays, periodBounds, presetPeriod, startOfDay, todayIn } from './periods'

describe('periods', () => {
  it('toma el día calendario del negocio, no el de UTC', () => {
    // 2026-10-10 03:00 UTC = 2026-10-09 22:00 en Bogotá.
    expect(todayIn('America/Bogota', new Date('2026-10-10T03:00:00Z'))).toBe('2026-10-09')
  })

  it('suma días cruzando meses', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('calcula los periodos predefinidos', () => {
    expect(presetPeriod('week', '2026-10-09')).toEqual({
      key: 'week',
      from: '2026-10-03',
      to: '2026-10-09',
    })
    expect(presetPeriod('month', '2026-10-09')).toEqual({
      key: 'month',
      from: '2026-10-01',
      to: '2026-10-09',
    })
    expect(presetPeriod('yesterday', '2026-10-01')).toEqual({
      key: 'yesterday',
      from: '2026-09-30',
      to: '2026-09-30',
    })
  })

  it('convierte el día del negocio a límites en UTC', () => {
    expect(startOfDay('2026-10-09', 'America/Bogota')).toBe('2026-10-09T05:00:00.000Z')
    expect(periodBounds({ from: '2026-10-09', to: '2026-10-09' }, 'America/Bogota')).toEqual({
      since: '2026-10-09T05:00:00.000Z',
      until: '2026-10-10T05:00:00.000Z',
    })
  })

  it('respeta el cambio de horario en zonas que lo tienen', () => {
    // Madrid pasa de UTC+2 a UTC+1 el 25 de octubre de 2026.
    expect(startOfDay('2026-10-25', 'Europe/Madrid')).toBe('2026-10-24T22:00:00.000Z')
    expect(startOfDay('2026-10-26', 'Europe/Madrid')).toBe('2026-10-25T23:00:00.000Z')
  })
})
