import { describe, expect, it } from 'vitest'
import { computeAccess, type SubscriptionInfo } from './access'

const now = new Date('2026-10-09T12:00:00Z')
const daysFromNow = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()

const base: SubscriptionInfo = {
  status: 'trialing',
  trial_ends_at: null,
  current_period_end: null,
  grace_days: 7,
}

describe('computeAccess', () => {
  it('prueba vigente: permite escribir y cuenta los días restantes', () => {
    expect(computeAccess({ ...base, trial_ends_at: daysFromNow(6.5) }, now)).toEqual({
      kind: 'trial',
      canWrite: true,
      daysLeft: 7,
    })
  })

  it('prueba vencida: solo lectura', () => {
    expect(computeAccess({ ...base, trial_ends_at: daysFromNow(-1) }, now).canWrite).toBe(false)
  })

  it('suscripción activa dentro del periodo', () => {
    const access = computeAccess(
      { ...base, status: 'active', current_period_end: daysFromNow(30) },
      now,
    )
    expect(access).toEqual({ kind: 'active', canWrite: true, daysLeft: 30 })
  })

  it('periodo vencido pero dentro de los días de gracia', () => {
    const access = computeAccess(
      { ...base, status: 'past_due', current_period_end: daysFromNow(-2) },
      now,
    )
    expect(access).toEqual({ kind: 'grace', canWrite: true, daysLeft: 5 })
  })

  it('gracia agotada: solo lectura', () => {
    const access = computeAccess(
      { ...base, status: 'past_due', current_period_end: daysFromNow(-8) },
      now,
    )
    expect(access.kind).toBe('expired')
  })

  it('cancelada, expirada o sin suscripción: solo lectura', () => {
    expect(computeAccess({ ...base, status: 'cancelled' }, now).canWrite).toBe(false)
    expect(computeAccess({ ...base, status: 'expired' }, now).canWrite).toBe(false)
    expect(computeAccess(null, now).canWrite).toBe(false)
  })
})
