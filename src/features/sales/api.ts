import { toUserMessage } from '../../lib/errors'
import { formatQuantity } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { periodBounds, type Period } from './periods'

export type Sale = Database['public']['Tables']['sales']['Row']
export type SaleItem = Database['public']['Tables']['sale_items']['Row']
export type SaleWithItems = Sale & { items: SaleItem[] }
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'credit' | 'other'

export type SalesSummary = {
  salesCount: number
  cancelledCount: number
  subtotal: number
  discountTotal: number
  total: number
  costTotal: number
  grossMargin: number
}

export type TopProduct = Database['public']['Functions']['top_products']['Returns'][number]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia (Nequi, Daviplata…)' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'credit', label: 'Fiado' },
  { value: 'other', label: 'Otro' },
]

export function paymentLabel(method: string): string {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label.split(' (')[0] ?? method
}

type PeriodRange = Pick<Period, 'from' | 'to'>

export const saleKeys = {
  all: (businessId: string) => ['sales', businessId] as const,
  list: (businessId: string, period: PeriodRange) =>
    ['sales', businessId, 'list', period.from, period.to] as const,
  detail: (businessId: string, saleId: string) => ['sales', businessId, 'detail', saleId] as const,
  summary: (businessId: string, period: PeriodRange) =>
    ['sales', businessId, 'summary', period.from, period.to] as const,
  top: (businessId: string, period: PeriodRange) =>
    ['sales', businessId, 'top', period.from, period.to] as const,
}

const MAX_SALES = 500

export async function fetchSales(
  businessId: string,
  period: PeriodRange,
  timeZone: string,
): Promise<Sale[]> {
  const { since, until } = periodBounds(period, timeZone)
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(MAX_SALES)
  if (error) throw error
  return data
}

export async function fetchSale(businessId: string, saleId: string): Promise<SaleWithItems | null> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .eq('business_id', businessId)
    .eq('id', saleId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchSalesSummary(
  businessId: string,
  period: PeriodRange,
): Promise<SalesSummary> {
  const { data, error } = await supabase
    .rpc('sales_summary', { p_business_id: businessId, p_from: period.from, p_to: period.to })
    .single()
  if (error) throw error
  return {
    salesCount: data.sales_count,
    cancelledCount: data.cancelled_count,
    subtotal: data.subtotal,
    discountTotal: data.discount_total,
    total: data.total,
    costTotal: data.cost_total,
    grossMargin: data.gross_margin,
  }
}

export async function fetchTopProducts(
  businessId: string,
  period: PeriodRange,
  limit = 10,
): Promise<TopProduct[]> {
  const { data, error } = await supabase.rpc('top_products', {
    p_business_id: businessId,
    p_from: period.from,
    p_to: period.to,
    p_limit: limit,
  })
  if (error) throw error
  return data
}

export async function createSale(input: {
  businessId: string
  items: { product_id: string; quantity: number; unit_price: number }[]
  paymentMethod: PaymentMethod
  discount: number
  note: string | null
  idempotencyKey: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_business_id: input.businessId,
    p_items: input.items,
    p_idempotency_key: input.idempotencyKey,
    p_payment_method: input.paymentMethod,
    p_discount: input.discount,
    ...(input.note ? { p_note: input.note } : {}),
  })
  if (error) throw error
  return data
}

export async function cancelSale(input: {
  businessId: string
  saleId: string
  reason: string
}): Promise<void> {
  const { error } = await supabase.rpc('cancel_sale', {
    p_business_id: input.businessId,
    p_sale_id: input.saleId,
    p_reason: input.reason,
  })
  if (error) throw error
}

/** Como toUserMessage, pero nombra el producto cuando falta stock. */
export function saleErrorMessage(error: unknown): string {
  const { message, details } = (error ?? {}) as { message?: unknown; details?: unknown }
  if (
    (message === 'insufficient_stock' || message === 'product_inactive') &&
    typeof details === 'string'
  ) {
    try {
      const detail = JSON.parse(details) as { product?: string; available?: number }
      if (message === 'product_inactive') {
        return `«${detail.product}» está archivado y no se puede vender.`
      }
      return `No alcanza «${detail.product}»: quedan ${formatQuantity(detail.available ?? 0)}. Alguien pudo haber vendido o sacado unidades hace un momento.`
    } catch {
      // Detalle ilegible: se usa el mensaje general.
    }
  }
  return toUserMessage(error)
}
