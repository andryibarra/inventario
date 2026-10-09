// Convierte las filas del archivo en una vista previa: qué se creará, qué se
// actualizará, qué se omite y por qué. Es solo una ayuda para decidir; la base
// de datos vuelve a validar todo al confirmar.

import { decimalPlaces, normalizeDecimal } from '../../lib/decimal'
import type { Product } from '../products/api'
import type { Unit } from '../products/units'
import { FIELDS, headerScore, normalizeHeader, type ColumnMapping, type FieldKey } from './columns'
import { hasContent, type Cell } from './readFile'
import { parseUnit } from './units'

export type ImportOptions = {
  /** Modificar los productos que ya existen (coinciden por referencia o código). */
  updateExisting: boolean
  /** Además, dejar sus existencias en la cantidad del archivo (solo con updateExisting). */
  adjustStock: boolean
  /** Crear también los productos cuyo nombre ya existe. */
  includeDuplicates: boolean
}

export const DEFAULT_OPTIONS: ImportOptions = {
  updateExisting: false,
  adjustStock: false,
  includeDuplicates: false,
}

/** Lo que recibe import_products por cada fila. Las claves ausentes = "sin dato". */
export type ImportRowPayload = {
  row: number
  name?: string
  sku?: string
  barcode?: string
  category?: string
  unit?: Unit
  sale_price?: number
  cost?: number
  quantity?: number
  low_stock_threshold?: number
}

export type RowStatus = 'new' | 'update' | 'skip' | 'duplicate' | 'error'

export type PreviewRow = {
  /** Número de fila como lo ve la persona en Excel (empieza en 1). */
  rowNumber: number
  status: RowStatus
  messages: string[]
  payload: ImportRowPayload
  /** Texto original de cada columna relacionada, para el reporte. */
  raw: Partial<Record<FieldKey, string>>
}

export type ExistingProduct = Pick<Product, 'id' | 'name' | 'sku' | 'barcode' | 'quantity'>

type NumericField = 'sale_price' | 'cost' | 'quantity' | 'low_stock_threshold'
type TextField = 'name' | 'sku' | 'barcode' | 'category'

const NUMERIC: Record<NumericField, { label: string; decimals: number }> = {
  sale_price: { label: 'Precio de venta', decimals: 2 },
  cost: { label: 'Costo', decimals: 2 },
  quantity: { label: 'Cantidad', decimals: 3 },
  low_stock_threshold: { label: 'Aviso de stock bajo', decimals: 3 },
}

const TEXT: Record<TextField, { label: string; max: number }> = {
  name: { label: 'Nombre', max: 200 },
  sku: { label: 'Referencia', max: 60 },
  barcode: { label: 'Código de barras', max: 60 },
  category: { label: 'Categoría', max: 60 },
}

const MAX_NUMBER = 1e10

/** Elige la fila de encabezados entre las primeras 10: la que más campos reconoce. */
export function detectHeaderRow(rows: readonly Cell[][]): number {
  let best = rows.findIndex((row) => row.filter(hasContent).length > 0)
  let bestScore = 0
  rows.slice(0, 10).forEach((row, index) => {
    const score = headerScore(row)
    if (score > bestScore) {
      best = index
      bestScore = score
    }
  })
  return Math.max(best, 0)
}

function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return ''
  return String(cell).trim()
}

function parseNumber(cell: Cell | undefined, field: NumericField): number | string | undefined {
  const { label, decimals } = NUMERIC[field]
  if (!hasContent(cell)) return undefined

  let value: number
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return `${label}: no es un número.`
    const factor = 10 ** decimals
    value = Math.round(cell * factor) / factor
    // Excel guarda resultados de fórmulas como 0,30000000000000004: se toleran.
    if (Math.abs(value - cell) > 1e-6) return `${label}: máximo ${decimals} decimales.`
  } else {
    const normalized = normalizeDecimal(String(cell))
    if (normalized === null) return `${label}: «${cellText(cell)}» no es un número válido.`
    if (decimalPlaces(normalized) > decimals) return `${label}: máximo ${decimals} decimales.`
    value = Number(normalized)
  }
  if (value < 0) return `${label}: no puede ser negativo.`
  if (value >= MAX_NUMBER) return `${label}: el número es demasiado grande.`
  return value
}

function parseRow(row: readonly Cell[], rowNumber: number, mapping: ColumnMapping) {
  const payload: ImportRowPayload = { row: rowNumber }
  const raw: Partial<Record<FieldKey, string>> = {}
  const errors: string[] = []

  for (const field of FIELDS) {
    const column = mapping[field.key]
    if (column === null) continue
    const cell = row[column]
    raw[field.key] = cellText(cell)
    if (!hasContent(cell)) continue

    if (field.key in NUMERIC) {
      const result = parseNumber(cell, field.key as NumericField)
      if (typeof result === 'string') errors.push(result)
      else if (result !== undefined) payload[field.key as NumericField] = result
    } else if (field.key === 'unit') {
      const unit = parseUnit(cellText(cell))
      if (unit) payload.unit = unit
      else
        errors.push(
          `Unidad «${cellText(cell)}» no reconocida. Usa: unidad, kg, g, litro, ml, metro, caja, paquete, docena o par.`,
        )
    } else {
      const key = field.key as TextField
      const text = cellText(cell)
      if (text.length > TEXT[key].max) {
        errors.push(`${TEXT[key].label}: máximo ${TEXT[key].max} caracteres.`)
      } else {
        payload[key] = text
      }
    }
  }
  return { payload, raw, errors }
}

export function buildPreview(
  rows: readonly Cell[][],
  headerIndex: number,
  mapping: ColumnMapping,
  existing: readonly ExistingProduct[],
  options: ImportOptions,
): PreviewRow[] {
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]))
  const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode!, p]))
  const byName = new Map(existing.map((p) => [normalizeHeader(p.name), p]))

  const seenSku = new Map<string, number>()
  const seenBarcode = new Map<string, number>()
  const seenName = new Map<string, number>()
  const preview: PreviewRow[] = []

  rows.forEach((row, index) => {
    if (index <= headerIndex) return
    const mapped = FIELDS.map((field) => mapping[field.key])
      .filter((column): column is number => column !== null)
      .map((column) => row[column])
    if (!mapped.some(hasContent)) return

    const rowNumber = index + 1
    const { payload, raw, errors } = parseRow(row, rowNumber, mapping)
    const push = (status: RowStatus, messages: string[]) =>
      preview.push({ rowNumber, status, messages, payload, raw })

    if (errors.length > 0) return push('error', errors)

    const skuKey = payload.sku?.toLowerCase()
    if (skuKey && seenSku.has(skuKey)) {
      return push('error', [`La referencia se repite: ya está en la fila ${seenSku.get(skuKey)}.`])
    }
    if (payload.barcode && seenBarcode.has(payload.barcode)) {
      return push('error', [
        `El código de barras se repite: ya está en la fila ${seenBarcode.get(payload.barcode)}.`,
      ])
    }
    if (skuKey) seenSku.set(skuKey, rowNumber)
    if (payload.barcode) seenBarcode.set(payload.barcode, rowNumber)

    const matchSku = skuKey ? bySku.get(skuKey) : undefined
    const matchBarcode = payload.barcode ? byBarcode.get(payload.barcode) : undefined
    if (matchSku && matchBarcode && matchSku.id !== matchBarcode.id) {
      return push('error', [
        `La referencia es de «${matchSku.name}» y el código de barras de «${matchBarcode.name}».`,
      ])
    }
    const match = matchSku ?? matchBarcode

    if (match) {
      if (!options.updateExisting) {
        return push('skip', [`Ya existe como «${match.name}». Se deja como está.`])
      }
      const messages = [`Se actualizan los datos de «${match.name}».`]
      if (
        options.adjustStock &&
        payload.quantity !== undefined &&
        payload.quantity !== match.quantity
      ) {
        messages.push(`Cantidad: ${match.quantity} → ${payload.quantity}.`)
      }
      return push('update', messages)
    }

    const missing: string[] = []
    if (!payload.name) missing.push('Falta el nombre del producto.')
    if (payload.sale_price === undefined) missing.push('Falta el precio de venta.')
    if (missing.length > 0) return push('error', missing)

    const warnings: string[] = []
    if ((payload.quantity ?? 0) > 0 && payload.cost === undefined) {
      warnings.push('Sin costo: no se podrá calcular la ganancia de este producto.')
    }

    const nameKey = normalizeHeader(payload.name)
    const sameName = byName.get(nameKey)
    const repeatedIn = seenName.get(nameKey)
    seenName.set(nameKey, seenName.get(nameKey) ?? rowNumber)
    if (sameName) {
      return push('duplicate', [`Ya tienes un producto llamado «${sameName.name}».`, ...warnings])
    }
    if (repeatedIn !== undefined) {
      return push('duplicate', [
        `El nombre se repite: ya está en la fila ${repeatedIn}.`,
        ...warnings,
      ])
    }
    return push('new', warnings)
  })

  return preview
}

export type PreviewCounts = Record<RowStatus, number>

export function countPreview(preview: readonly PreviewRow[]): PreviewCounts {
  const counts: PreviewCounts = { new: 0, update: 0, skip: 0, duplicate: 0, error: 0 }
  for (const row of preview) counts[row.status]++
  return counts
}

/** Filas que se envían al servidor según las opciones elegidas. */
export function rowsToImport(
  preview: readonly PreviewRow[],
  options: ImportOptions,
): ImportRowPayload[] {
  return preview
    .filter(
      (row) =>
        row.status === 'new' ||
        row.status === 'update' ||
        (row.status === 'duplicate' && options.includeDuplicates),
    )
    .map((row) => row.payload)
}
