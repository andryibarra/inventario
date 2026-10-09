import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { computeAccess, type SubscriptionInfo } from './access'

async function fetchSubscription(businessId: string): Promise<SubscriptionInfo | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end, grace_days')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function useSubscription(businessId: string) {
  const query = useQuery({
    queryKey: ['subscription', businessId],
    queryFn: () => fetchSubscription(businessId),
  })
  return {
    ...query,
    access: query.data === undefined ? null : computeAccess(query.data),
  }
}
