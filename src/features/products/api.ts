import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { WithRequired } from '../../lib/types'
import type { Database } from '../../types/database'
import type { NewProductValues, ProductValues } from './schemas'

type OverviewRow = Database['public']['Views']['product_overview']['Row']

export type Product = WithRequired<
  OverviewRow,
  | 'id'
  | 'business_id'
  | 'name'
  | 'unit'
  | 'sale_price'
  | 'low_stock_threshold'
  | 'is_active'
  | 'quantity'
  | 'average_cost'
  | 'stock_value'
  | 'is_low_stock'
  | 'created_at'
  | 'updated_at'
>

export type Category = Database['public']['Tables']['categories']['Row']

export type ProductFilter = 'active' | 'low' | 'archived' | 'all'

export type ProductQuery = {
  filter: ProductFilter
  search: string
  categoryId: string | null
}

export const productKeys = {
  all: (businessId: string) => ['products', businessId] as const,
  list: (businessId: string, query: ProductQuery) =>
    ['products', businessId, 'list', query] as const,
  detail: (businessId: string, productId: string) =>
    ['products', businessId, 'detail', productId] as const,
  categories: (businessId: string) => ['categories', businessId] as const,
}

/** Después de cualquier cambio de stock o de catálogo. */
export async function invalidateInventory(queryClient: QueryClient, businessId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['products', businessId] }),
    queryClient.invalidateQueries({ queryKey: ['movements', businessId] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-summary', businessId] }),
  ])
}

// Caracteres con significado en los filtros de PostgREST; no aportan a la búsqueda.
function cleanSearch(search: string): string {
  return search.replace(/[,()*%\\"]/g, ' ').trim()
}

const MAX_PRODUCTS = 1000

export async function fetchProducts(businessId: string, query: ProductQuery): Promise<Product[]> {
  let request = supabase.from('product_overview').select('*').eq('business_id', businessId)

  if (query.filter === 'active') request = request.eq('is_active', true)
  if (query.filter === 'archived') request = request.eq('is_active', false)
  if (query.filter === 'low') request = request.eq('is_low_stock', true)
  if (query.categoryId) request = request.eq('category_id', query.categoryId)

  const term = cleanSearch(query.search)
  if (term) {
    request = request.or(`name.ilike.*${term}*,sku.ilike.*${term}*,barcode.ilike.*${term}*`)
  }

  const { data, error } = await request.order('name').limit(MAX_PRODUCTS)
  if (error) throw error
  return data as Product[]
}

export async function fetchProduct(businessId: string, productId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('product_overview')
    .select('*')
    .eq('business_id', businessId)
    .eq('id', productId)
    .maybeSingle()
  if (error) throw error
  return data as Product | null
}

export async function fetchCategories(businessId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('name')
  if (error) throw error
  return data
}

// Los opcionales vacíos se omiten: la función usa su valor por defecto (null).
function productArgs(values: ProductValues) {
  return {
    p_name: values.name,
    p_sale_price: values.salePrice,
    p_unit: values.unit,
    p_low_stock_threshold: values.lowStockThreshold,
    ...(values.sku ? { p_sku: values.sku } : {}),
    ...(values.barcode ? { p_barcode: values.barcode } : {}),
    ...(values.categoryId ? { p_category_id: values.categoryId } : {}),
  }
}

export async function createProduct(input: {
  businessId: string
  values: NewProductValues
  idempotencyKey: string
}): Promise<string> {
  const { values } = input
  const { data, error } = await supabase.rpc('create_product', {
    p_business_id: input.businessId,
    ...productArgs(values),
    p_initial_quantity: values.initialQuantity,
    ...(values.initialUnitCost !== null ? { p_initial_unit_cost: values.initialUnitCost } : {}),
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data
}

export async function updateProduct(input: {
  businessId: string
  productId: string
  values: ProductValues
}): Promise<void> {
  const { error } = await supabase.rpc('update_product', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    ...productArgs(input.values),
  })
  if (error) throw error
}

export async function setProductActive(input: {
  businessId: string
  productId: string
  active: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('set_product_active', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_active: input.active,
  })
  if (error) throw error
}

export async function createCategory(input: { businessId: string; name: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_category', {
    p_business_id: input.businessId,
    p_name: input.name,
  })
  if (error) throw error
  return data
}

export async function renameCategory(input: {
  businessId: string
  categoryId: string
  name: string
}): Promise<void> {
  const { error } = await supabase.rpc('rename_category', {
    p_business_id: input.businessId,
    p_category_id: input.categoryId,
    p_name: input.name,
  })
  if (error) throw error
}

export async function deleteCategory(input: {
  businessId: string
  categoryId: string
}): Promise<void> {
  const { error } = await supabase.rpc('delete_category', {
    p_business_id: input.businessId,
    p_category_id: input.categoryId,
  })
  if (error) throw error
}
