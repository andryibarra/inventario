import type { Database } from '../../types/database'

export type SubscriptionInfo = Pick<
  Database['public']['Tables']['subscriptions']['Row'],
  'status' | 'trial_ends_at' | 'current_period_end' | 'grace_days'
>

export type Access =
  | { kind: 'trial'; canWrite: true; daysLeft: number }
  | { kind: 'active'; canWrite: true; daysLeft: number }
  | { kind: 'grace'; canWrite: true; daysLeft: number }
  | { kind: 'expired'; canWrite: false; daysLeft: null }

const DAY_MS = 24 * 60 * 60 * 1000

function daysUntil(date: Date, now: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS))
}

/**
 * Refleja private.can_write() para mostrar avisos en la interfaz.
 * La decisión real la toma siempre la base de datos.
 */
export function computeAccess(sub: SubscriptionInfo | null, now = new Date()): Access {
  const expired = { kind: 'expired', canWrite: false, daysLeft: null } as const
  if (!sub) return expired

  if (sub.status === 'trialing') {
    if (!sub.trial_ends_at) return expired
    const trialEnd = new Date(sub.trial_ends_at)
    return trialEnd > now
      ? { kind: 'trial', canWrite: true, daysLeft: daysUntil(trialEnd, now) }
      : expired
  }

  if ((sub.status === 'active' || sub.status === 'past_due') && sub.current_period_end) {
    const periodEnd = new Date(sub.current_period_end)
    const graceEnd = new Date(periodEnd.getTime() + sub.grace_days * DAY_MS)
    if (periodEnd > now) {
      return { kind: 'active', canWrite: true, daysLeft: daysUntil(periodEnd, now) }
    }
    if (graceEnd > now) {
      return { kind: 'grace', canWrite: true, daysLeft: daysUntil(graceEnd, now) }
    }
  }

  return expired
}
