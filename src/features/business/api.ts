import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

type Business = Database['public']['Tables']['businesses']['Row']
export type MemberRole = Database['public']['Enums']['member_role']

export type Membership = Pick<
  Business,
  'id' | 'name' | 'business_type' | 'currency' | 'timezone' | 'status'
> & { role: MemberRole }

export const businessKeys = {
  memberships: (userId: string) => ['memberships', userId] as const,
}

export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select('role, business:businesses(id, name, business_type, currency, timezone, status)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at')
  if (error) throw error
  return data.flatMap((m) => (m.business ? [{ ...m.business, role: m.role }] : []))
}

export async function createBusiness(input: {
  name: string
  businessType: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_business', {
    p_name: input.name,
    ...(input.businessType ? { p_business_type: input.businessType } : {}),
  })
  if (error) throw error
  return data
}

export async function updateBusiness(input: {
  businessId: string
  name: string
  businessType: string | null
  timezone: string
}): Promise<void> {
  const { error } = await supabase.rpc('update_business', {
    p_business_id: input.businessId,
    p_name: input.name,
    ...(input.businessType ? { p_business_type: input.businessType } : {}),
    p_timezone: input.timezone,
  })
  if (error) throw error
}

export function canManageBusiness(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin'
}
