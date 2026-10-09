import { supabase } from '../../lib/supabase'
import type { WithRequired } from '../../lib/types'
import type { Database } from '../../types/database'

export type MovementType = Database['public']['Enums']['movement_type']

type HistoryRow = Database['public']['Views']['movement_history']['Row']

export type Movement = WithRequired<
  HistoryRow,
  | 'id'
  | 'business_id'
  | 'product_id'
  | 'product_name'
  | 'unit'
  | 'movement_type'
  | 'quantity_delta'
  | 'unit_cost'
  | 'balance_after'
  | 'average_cost_after'
  | 'created_at'
>

export type InventorySummary = {
  activeProducts: number
  lowStockProducts: number
  stockValue: number
}

/** Grupos que se muestran como filtro en el historial. */
export type MovementGroup = 'all' | 'in' | 'out' | 'adjustment'

const GROUP_TYPES: Record<Exclude<MovementGroup, 'all'>, MovementType[]> = {
  in: ['initial', 'purchase', 'sale_reversal', 'return'],
  out: ['output', 'sale'],
  adjustment: ['adjustment'],
}

export type MovementQuery = {
  productId?: string
  group?: MovementGroup
  limit: number
}

export const movementKeys = {
  list: (businessId: string, query: MovementQuery) =>
    ['movements', businessId, 'list', query] as const,
  summary: (businessId: string) => ['inventory-summary', businessId] as const,
}

export async function fetchMovements(
  businessId: string,
  query: MovementQuery,
): Promise<Movement[]> {
  let request = supabase.from('movement_history').select('*').eq('business_id', businessId)
  if (query.productId) request = request.eq('product_id', query.productId)
  if (query.group && query.group !== 'all') {
    request = request.in('movement_type', GROUP_TYPES[query.group])
  }
  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id')
    .limit(query.limit)
  if (error) throw error
  return data as Movement[]
}

export async function fetchSummary(businessId: string): Promise<InventorySummary> {
  const { data, error } = await supabase
    .from('inventory_summary')
    .select('active_products, low_stock_products, stock_value')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw error
  return {
    activeProducts: data?.active_products ?? 0,
    lowStockProducts: data?.low_stock_products ?? 0,
    stockValue: data?.stock_value ?? 0,
  }
}

export async function recordMovement(input: {
  businessId: string
  productId: string
  type: 'purchase' | 'output'
  quantity: number
  unitCost: number | null
  reason: string | null
  idempotencyKey: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('record_stock_movement', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_type: input.type,
    p_quantity: input.quantity,
    ...(input.unitCost !== null ? { p_unit_cost: input.unitCost } : {}),
    ...(input.reason ? { p_reason: input.reason } : {}),
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data
}

export async function adjustStock(input: {
  businessId: string
  productId: string
  countedQuantity: number
  reason: string
  idempotencyKey: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_counted_quantity: input.countedQuantity,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data
}
