import { toUserMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import type { ImportOptions, ImportRowPayload } from './preview'

export type ImportRecord = Database['public']['Tables']['imports']['Row']

export type ImportSummary = {
  import_id: string
  rows_total: number
  rows_created: number
  rows_updated: number
  rows_stock_adjusted: number
  rows_skipped: number
  already_imported: boolean
}

export const importKeys = {
  list: (businessId: string) => ['imports', businessId] as const,
}

export async function fetchImports(businessId: string): Promise<ImportRecord[]> {
  const { data, error } = await supabase
    .from('imports')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return data
}

export async function importProducts(input: {
  businessId: string
  importId: string
  fileName: string
  rows: ImportRowPayload[]
  options: ImportOptions
  rowsTotal: number
}): Promise<ImportSummary> {
  const { data, error } = await supabase.rpc('import_products', {
    p_business_id: input.businessId,
    p_import_id: input.importId,
    p_file_name: input.fileName,
    p_rows: input.rows,
    p_update_existing: input.options.updateExisting,
    p_adjust_stock: input.options.updateExisting && input.options.adjustStock,
    p_rows_total: input.rowsTotal,
    p_rows_invalid: input.rowsTotal - input.rows.length,
  })
  if (error) throw error
  return data as ImportSummary
}

/** Como toUserMessage, pero indica la fila cuando la base de datos rechaza una. */
export function importErrorMessage(error: unknown): string {
  const { message, details } = (error ?? {}) as { message?: unknown; details?: unknown }
  if (message === 'import_row_failed' && typeof details === 'string') {
    try {
      const detail = JSON.parse(details) as { row?: number; error?: string }
      const reason = toUserMessage({ message: detail.error })
      const known = reason !== toUserMessage(null)
      return `No se importó nada. Fila ${detail.row}: ${known ? reason : 'tiene un dato que no es válido.'}`
    } catch {
      // Detalle ilegible: se usa el mensaje general.
    }
  }
  return toUserMessage(error)
}
